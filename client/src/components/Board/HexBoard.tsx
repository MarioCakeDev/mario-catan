import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import type { Board, Building, Road, Hex, TerrainType } from '@catan/shared';
import { useGameStore } from '../../store/gameStore';
import { useGameActions } from '../../hooks/useSocket';
import { MobilePlacementControls } from '../UI/MobilePlacementControls';
import './HexBoard.css';

interface HexBoardProps {
    board: Board;
    buildings: Building[];
    roads: Road[];
}

// Flat-top hexagons
const HEX_SIZE = 45;

// Hex neighbor directions (axial coordinates, flat-top)
const HEX_DIRECTIONS = [
    { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
    { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }
];

function getHexNeighbors(coord: { q: number; r: number }) {
    return HEX_DIRECTIONS.map(d => ({ q: coord.q + d.q, r: coord.r + d.r }));
}

// Convert axial to pixel
function hexToPixel(q: number, r: number): { x: number; y: number } {
    const x = HEX_SIZE * (3 / 2 * q);
    const y = HEX_SIZE * (Math.sqrt(3) * (r + q / 2));
    return { x, y };
}

// Get 6 corners
function getHexCorners(centerX: number, centerY: number): { x: number, y: number }[] {
    const corners: { x: number, y: number }[] = [];
    for (let i = 0; i < 6; i++) {
        const angle = Math.PI / 180 * (60 * i);
        corners.push({
            x: centerX + HEX_SIZE * Math.cos(angle),
            y: centerY + HEX_SIZE * Math.sin(angle)
        });
    }
    return corners;
}

const TERRAIN_COLORS: Record<TerrainType, string> = {
    brick: '#b74c3c',
    lumber: '#2d6b4f',
    ore: '#5d6d7e',
    wheat: '#d4a017',
    sheep: '#7fb069',
    desert: '#c9b896',
    water: '#3498db'
};

const TERRAIN_ICONS: Record<TerrainType, string> = {
    brick: '🧱',
    lumber: '🌲',
    ore: '⛏️',
    wheat: '🌾',
    sheep: '🐑',
    desert: '🏜️',
    water: ''
};

function HexTile({ hex }: { hex: Hex }) {
    const { x, y } = hexToPixel(hex.coord.q, hex.coord.r);
    const corners = getHexCorners(0, 0);
    const points = corners.map(c => `${c.x},${c.y}`).join(' ');

    const isHighProbability = hex.number === 6 || hex.number === 8;
    const probabilityDots = hex.number ? 6 - Math.abs(7 - hex.number) : 0;
    const isSea = (hex.terrain as string) === 'water';

    return (
        <g transform={`translate(${x}, ${y})`} className={`hex-tile ${isSea ? 'sea-hex' : ''}`} role="img" aria-label={`${hex.terrain} hex, number ${hex.number || 'none'}`}>
            <polygon
                points={points}
                fill={TERRAIN_COLORS[hex.terrain] || '#fff'}
                stroke={isSea ? '#2980b9' : '#1a1a2e'}
                strokeWidth={isSea ? "0" : "2"}
                className="hex-polygon"
                opacity={isSea ? 0.7 : 1}
            />

            {hex.terrain !== 'desert' && hex.terrain !== 'water' as any && (
                <text x="0" y="-15" textAnchor="middle" fontSize="16" className="resource-icon" aria-hidden="true">
                    {TERRAIN_ICONS[hex.terrain]}
                </text>
            )}

            {hex.number && !isSea && (
                <g className="number-token" aria-hidden="true">
                    <circle cx="0" cy="10" r="12" fill="#fafafa" stroke="#333" strokeWidth="1.5" />
                    <text
                        x="0"
                        y="14"
                        textAnchor="middle"
                        fontSize="12"
                        fontWeight="bold"
                        fill={isHighProbability ? '#c0392b' : '#2c3e50'}
                    >
                        {hex.number}
                    </text>
                    <g>
                        {Array.from({ length: Math.min(5, probabilityDots) }, (_, i) => (
                            <circle
                                key={i}
                                cx={-6 + i * 3}
                                cy="22"
                                r="1.5"
                                fill={isHighProbability ? '#c0392b' : '#666'}
                            />
                        ))}
                    </g>
                </g>
            )}

            {hex.hasRobber && (
                <g className="robber" aria-label="Robber">
                    <ellipse cx="0" cy="5" rx="8" ry="12" fill="#1a1a2e" stroke="#555" strokeWidth="1.5" />
                    <circle cx="0" cy="-8" r="6" fill="#1a1a2e" stroke="#555" strokeWidth="1.5" />
                </g>
            )}
        </g>
    );
}

function HexBoard({ board, buildings, roads }: HexBoardProps) {
    const buildMode = useGameStore(state => state.buildMode);
    const setBuildMode = useGameStore(state => state.setBuildMode);
    const playerId = useGameStore(state => state.playerId);
    const gameState = useGameStore(state => state.gameState);
    const { buildSettlement, buildRoad, buildCity, moveRobber } = useGameActions();

    // Mobile Selection State
    const [selectedPlacement, setSelectedPlacement] = useState<{ type: 'vertex' | 'edge'; id: string } | null>(null);
    const [hoveredElement] = useState<{ type: 'vertex' | 'edge' | 'hex', id: string } | null>(null);

    // Touch zoom/pan state
    const svgRef = useRef<SVGSVGElement>(null);
    const [viewBox, setViewBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
    const touchState = useRef({
        lastDist: 0,
        lastMid: { x: 0, y: 0 },
        lastTouches: [] as { x: number; y: number }[],
        isPanning: false,
        startPan: { x: 0, y: 0 }
    });

    const isMyTurn = gameState?.currentPlayerId === playerId;
    const phase = gameState?.phase;
    const turnPhase = gameState?.turnPhase;
    const canBuild = isMyTurn && (phase === 'setup' || turnPhase === 'main');
    const isRobberPhase = isMyTurn && turnPhase === 'robber';

    // Clear selection when build mode changes
    useEffect(() => {
        setSelectedPlacement(null);
    }, [buildMode]);

    // Compute correct vertex positions from hex geometry
    const vertexPositions = useMemo(() => {
        const result = new Map<string, { x: number, y: number }>();
        if (!board.hexes.length) return result;

        const hexMap = new Map<string, { x: number; y: number }>();
        for (const hex of board.hexes) {
            hexMap.set(`${hex.coord.q},${hex.coord.r}`, hexToPixel(hex.coord.q, hex.coord.r));
        }

        // Flat-top hex corner angles (degrees): 0, 60, 120, 180, 240, 300
        const cornerAngles = [0, 60, 120, 180, 240, 300];

        const vertexHexSets = new Map<string, Set<string>>();
        for (const vertex of board.vertices) {
            vertexHexSets.set(vertex.id, new Set(vertex.hexes.map(h => `${h.q},${h.r}`)));
        }

        for (const vertex of board.vertices) {
            if (vertex.hexes.length === 0) continue;

            // Find which corner of each touching hex this vertex is at
            const positions: { x: number; y: number }[] = [];

            for (const hexCoord of vertex.hexes) {
                const center = hexMap.get(`${hexCoord.q},${hexCoord.r}`);
                if (!center) continue;

                const neighbors = getHexNeighbors(hexCoord);
                const vertexSet = vertexHexSets.get(vertex.id)!;

                for (let i = 0; i < 6; i++) {
                    const n1 = neighbors[i];
                    const n2 = neighbors[(i + 1) % 6];

                    // The corner set: this hex plus its two neighbors, filtered to board hexes
                    const cornerSet = new Set([
                        `${hexCoord.q},${hexCoord.r}`,
                        `${n1.q},${n1.r}`,
                        `${n2.q},${n2.r}`
                    ]);
                    for (const key of [...cornerSet]) {
                        if (!hexMap.has(key)) cornerSet.delete(key);
                    }

                    // Match if the corner set equals the vertex's hex set
                    if (cornerSet.size === vertexSet.size && [...cornerSet].every(k => vertexSet.has(k))) {
                        const angle = (Math.PI / 180) * cornerAngles[i];
                        positions.push({
                            x: center.x + HEX_SIZE * Math.cos(angle),
                            y: center.y + HEX_SIZE * Math.sin(angle)
                        });
                        break;
                    }
                }
            }

            if (positions.length > 0) {
                // Average positions (should be very close or identical)
                const avgX = positions.reduce((s, p) => s + p.x, 0) / positions.length;
                const avgY = positions.reduce((s, p) => s + p.y, 0) / positions.length;
                result.set(vertex.id, { x: avgX, y: avgY });
            }
        }
        return result;
    }, [board]);

    if (!board.hexes.length) {
        return <div className="hex-board-loading">Loading board...</div>;
    }

    const allPositions = board.hexes.map(h => hexToPixel(h.coord.q, h.coord.r));
    const minX = Math.min(...allPositions.map(p => p.x)) - HEX_SIZE - 40;
    const maxX = Math.max(...allPositions.map(p => p.x)) + HEX_SIZE + 40;
    const minY = Math.min(...allPositions.map(p => p.y)) - HEX_SIZE - 40;
    const maxY = Math.max(...allPositions.map(p => p.y)) + HEX_SIZE + 40;
    const width = maxX - minX;
    const height = maxY - minY;

    const buildingsByVertex = useMemo(() => {
        const map: Record<string, Building> = {};
        buildings.forEach(b => { map[b.vertexId] = b; });
        return map;
    }, [buildings]);

    const roadsByEdge = useMemo(() => {
        const map: Record<string, Road> = {};
        roads.forEach(r => { map[r.edgeId] = r; });
        return map;
    }, [roads]);

    const getPlayerColor = (pId: string | null) => {
        if (!pId) return 'gray';
        const player = gameState?.players.find(p => p.id === pId);
        return player?.color || 'gray';
    };

    const handleHexClick = (hex: Hex) => {
        if (isRobberPhase) {
            moveRobber(hex.coord);
        }
    };

    // Mobile Interaction: Tap to select, then confirm via UI
    const handleVertexClick = (vertexId: string) => {
        if (!canBuild) return;
        // In setup, always allow vertex selection (settlement)
        if (buildMode && buildMode !== 'settlement' && buildMode !== 'city') return;

        // Toggle selection
        if (selectedPlacement?.id === vertexId) {
            setSelectedPlacement(null);
        } else {
            setSelectedPlacement({ type: 'vertex', id: vertexId });
        }
    };

    const handleEdgeClick = (edgeId: string) => {
        if (!canBuild) return;
        // In setup, allow edge selection for road; otherwise only in road mode
        if (buildMode !== 'road' && !(phase === 'setup' && !buildMode)) return;

        // Toggle selection
        if (selectedPlacement?.id === edgeId) {
            setSelectedPlacement(null);
        } else {
            setSelectedPlacement({ type: 'edge', id: edgeId });
        }
    };

    const handleConfirmPlacement = () => {
        if (!selectedPlacement) return;

        const effectiveMode = buildMode || (phase === 'setup' ? 'settlement' : null);

        if (selectedPlacement.type === 'vertex') {
            if (effectiveMode === 'city') {
                buildCity(selectedPlacement.id);
            } else {
                buildSettlement(selectedPlacement.id);
                // In setup: after settlement, auto-switch to road mode
                if (phase === 'setup') {
                    setSelectedPlacement(null);
                    setBuildMode('road');
                    return;
                }
            }
        } else if (selectedPlacement.type === 'edge') {
            buildRoad(selectedPlacement.id);
        }

        setSelectedPlacement(null);
        if (phase !== 'setup' && buildMode !== 'city') {
            setBuildMode(null);
        }
    };

    const handleCancelPlacement = () => {
        setSelectedPlacement(null);
        setBuildMode(null);
    };

    const myPlayerId = playerId || '';

    // Touch zoom/pan handlers
    const getTouchDist = (t1: { x: number; y: number }, t2: { x: number; y: number }) =>
        Math.hypot(t2.x - t1.x, t2.y - t1.y);

    const getTouchMid = (t1: { x: number; y: number }, t2: { x: number; y: number }) =>
        ({ x: (t1.x + t2.x) / 2, y: (t1.y + t2.y) / 2 });

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            const t = e.touches;
            const t1 = { x: t[0].clientX, y: t[0].clientY };
            const t2 = { x: t[1].clientX, y: t[1].clientY };
            touchState.current.lastDist = getTouchDist(t1, t2);
            touchState.current.lastMid = getTouchMid(t1, t2);
            touchState.current.lastTouches = [t1, t2];
        } else if (e.touches.length === 1) {
            touchState.current.isPanning = true;
            touchState.current.startPan = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
    }, []);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (e.touches.length === 2 && viewBox) {
            e.preventDefault();
            const t = e.touches;
            const t1 = { x: t[0].clientX, y: t[0].clientY };
            const t2 = { x: t[1].clientX, y: t[1].clientY };
            const newDist = getTouchDist(t1, t2);
            const newMid = getTouchMid(t1, t2);
            const scale = touchState.current.lastDist / newDist;

            const svg = svgRef.current;
            if (!svg) return;
            const rect = svg.getBoundingClientRect();

            // Convert mid to SVG coords
            const midSvg = {
                x: viewBox.x + (newMid.x - rect.left) / rect.width * viewBox.w,
                y: viewBox.y + (newMid.y - rect.top) / rect.height * viewBox.h
            };

            const newW = viewBox.w * scale;
            const newH = viewBox.h * scale;
            const newX = midSvg.x - (midSvg.x - viewBox.x) * scale;
            const newY = midSvg.y - (midSvg.y - viewBox.y) * scale;

            setViewBox({ x: newX, y: newY, w: newW, h: newH });
            touchState.current.lastDist = newDist;
            touchState.current.lastMid = newMid;
        } else if (e.touches.length === 1 && touchState.current.isPanning && viewBox) {
            const touch = e.touches[0];
            const dx = touch.clientX - touchState.current.startPan.x;
            const dy = touch.clientY - touchState.current.startPan.y;
            const svg = svgRef.current;
            if (!svg) return;
            const rect = svg.getBoundingClientRect();
            const svgDx = -dx / rect.width * viewBox.w;
            const svgDy = -dy / rect.height * viewBox.h;
            setViewBox(v => v ? { ...v, x: v.x + svgDx, y: v.y + svgDy } : v);
            touchState.current.startPan = { x: touch.clientX, y: touch.clientY };
        }
    }, [viewBox]);

    const handleTouchEnd = useCallback(() => {
        touchState.current.isPanning = false;
    }, []);

    const resetView = useCallback(() => {
        setViewBox(null);
    }, []);

    return (
        <div className="hex-board-container">
            {/* Mobile Bottom Sheet Controls */}
            {canBuild && (buildMode || phase === 'setup') && (
                <MobilePlacementControls
                    onConfirm={handleConfirmPlacement}
                    onCancel={handleCancelPlacement}
                    isValid={!!selectedPlacement && (
                        (selectedPlacement.type === 'vertex' && (buildMode === 'settlement' || buildMode === 'city' || (!buildMode && phase === 'setup'))) ||
                        (selectedPlacement.type === 'edge' && (buildMode === 'road' || (!buildMode && phase === 'setup')))
                    )}
                    selectionType={buildMode || (phase === 'setup' ? (selectedPlacement?.type === 'edge' ? 'road' : 'settlement') : null)}
                />
            )}

            {canBuild && (
                <div className="build-mode-indicator" role="status">
                    {phase === 'setup' ? (
                        <span>🏠 Setup: Place settlement then road</span>
                    ) : buildMode ? (
                        <span>Build: {buildMode}</span>
                    ) : (
                        <span>Your turn</span>
                    )}
                </div>
            )}

            {isRobberPhase && (
                <div className="build-mode-indicator robber-mode" role="status">
                    💂 Move the Robber! Tap a hex.
                </div>
            )}

            <svg
                ref={svgRef}
                className={`hex-board ${canBuild ? 'can-build' : ''}`}
                viewBox={viewBox ? `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}` : `${minX} ${minY} ${width} ${height}`}
                preserveAspectRatio="xMidYMid meet"
                role="application"
                aria-label="Catan Game Board"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{ touchAction: 'none' }}
            >
                <rect x={minX} y={minY} width={width} height={height} fill="#2c3e50" />

                {/* Hexes */}
                <g className="hexes">
                    {board.hexes.map((hex, i) => (
                        <g
                            key={i}
                            onClick={() => handleHexClick(hex)}
                            style={{ cursor: isRobberPhase && !hex.hasRobber ? 'pointer' : 'default' }}
                            opacity={isRobberPhase && hoveredElement?.type === 'hex' && hoveredElement.id === `${hex.coord.q},${hex.coord.r}` ? 0.8 : 1}
                        >
                            <HexTile hex={hex} />
                        </g>
                    ))}
                </g>

                {/* Roads */}
                <g className="roads">
                    {board.edges.map(edge => {
                        const p1 = vertexPositions.get(edge.vertices[0]);
                        const p2 = vertexPositions.get(edge.vertices[1]);
                        if (!p1 || !p2) return null;

                        const existingRoad = roadsByEdge[edge.id];
                        const isClickable = canBuild && !existingRoad && buildMode === 'road';
                        const isSelected = selectedPlacement?.type === 'edge' && selectedPlacement.id === edge.id;

                        return (
                            <g key={edge.id} className="road-group">
                                {/* Visual Road Line */}
                                <line
                                    x1={p1.x} y1={p1.y}
                                    x2={p2.x} y2={p2.y}
                                    stroke={existingRoad ? `var(--color-player-${getPlayerColor(existingRoad.playerId)})` : (isSelected ? `var(--color-player-${getPlayerColor(myPlayerId)})` : 'transparent')}
                                    strokeWidth={existingRoad ? 6 : (isSelected ? 8 : 0)}
                                    strokeLinecap="round"
                                    className={`edge ${isSelected ? 'selected' : ''}`}
                                    style={{
                                        transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                        opacity: isSelected ? 0.8 : 1
                                    }}
                                />

                                {/* Invisible Hit Target (48px wide) for Touch */}
                                {isClickable && (
                                    <line
                                        x1={p1.x} y1={p1.y}
                                        x2={p2.x} y2={p2.y}
                                        stroke="transparent"
                                        strokeWidth="48"
                                        className="hit-target"
                                        onClick={() => handleEdgeClick(edge.id)}
                                        style={{ cursor: 'pointer' }}
                                    />
                                )}
                            </g>
                        );
                    })}
                </g>

                {/* Buildings / Vertices */}
                <g className="vertices">
                    {board.vertices.map(vertex => {
                        const pos = vertexPositions.get(vertex.id);
                        if (!pos) return null;

                        const existing = buildingsByVertex[vertex.id];
                        // Logic for separate modes
                        const isSettlementMode = buildMode === 'settlement' || (phase === 'setup' && !buildMode);
                        const isCityMode = buildMode === 'city';

                        let isClickable = false;
                        if (canBuild) {
                            if (isSettlementMode && !existing) isClickable = true;
                            if (isCityMode && existing?.type === 'settlement' && existing.playerId === playerId) isClickable = true;
                        }

                        const isSelected = selectedPlacement?.type === 'vertex' && selectedPlacement.id === vertex.id;

                        // Mobile: Selected state shows the "ghost"
                        // Desktop: Hover shows ghost (we keep hover for desktop via CSS/mouse events if needed, but tap is primary)
                        const showGhost = isSelected && !existing;

                        return (
                            <g
                                key={vertex.id}
                                transform={`translate(${pos.x}, ${pos.y})`}
                                className={`vertex-group ${isSelected ? 'selected' : ''}`}
                            >
                                {/* Settlements/Cities Visuals */}
                                {(existing?.type === 'settlement' || (showGhost && isSettlementMode)) && (
                                    <path
                                        d="M0,-12 L10,0 L10,10 L-10,10 L-10,0 Z"
                                        fill={existing ? `var(--color-player-${getPlayerColor(existing.playerId)})` : `var(--color-player-${getPlayerColor(myPlayerId)})`}
                                        stroke="#fff"
                                        strokeWidth="2"
                                        className={existing ? 'settlement' : 'ghost-settlement'}
                                        style={{
                                            transform: isSelected ? 'scale(1.2)' : 'scale(1)',
                                            opacity: existing ? 1 : 0.7,
                                            filter: isSelected ? 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))' : 'none'
                                        }}
                                    />
                                )}

                                {(existing?.type === 'city' || (showGhost && isCityMode)) && (
                                    <path
                                        d="M-12,12 L-12,-4 L-6,-10 L6,-10 L12,-4 L12,12 Z"
                                        fill={existing ? `var(--color-player-${getPlayerColor(existing.playerId)})` : `var(--color-player-${getPlayerColor(myPlayerId)})`}
                                        stroke="#fff"
                                        strokeWidth="2"
                                        className={existing ? 'city' : 'ghost-city'}
                                        opacity={existing ? 1 : 0.7}
                                    />
                                )}

                                {/* Invisible Touch Target (48x48px circle) */}
                                {isClickable && (
                                    <circle
                                        r="24"
                                        fill="transparent"
                                        className="hit-target"
                                        onClick={() => handleVertexClick(vertex.id)}
                                        style={{ cursor: 'pointer' }}
                                    />
                                )}

                                {/* Pulse Indicator for Valid Spots (when nothing selected) */}
                                {isClickable && !selectedPlacement && !existing && (
                                    <circle
                                        r="6"
                                        fill="white"
                                        opacity="0.3"
                                        className="valid-spot-indicator"
                                        style={{ pointerEvents: 'none' }}
                                    />
                                )}
                            </g>
                        );
                    })}
                </g>

                {/* Harbors */}
                <g className="harbors">
                    {board.ports.map((port, i) => {
                        const p1 = vertexPositions.get(port.vertexIds[0]);
                        const p2 = vertexPositions.get(port.vertexIds[1]);
                        if (!p1 || !p2) return null;

                        const midX = (p1.x + p2.x) / 2;
                        const midY = (p1.y + p2.y) / 2;
                        // Push outward
                        const boardCenterX = (minX + maxX) / 2;
                        const boardCenterY = (minY + maxY) / 2;
                        const dx = midX - boardCenterX;
                        const dy = midY - boardCenterY;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        const pushX = (dx / dist) * 20;
                        const pushY = (dy / dist) * 20;

                        return (
                            <g key={i} transform={`translate(${midX + pushX}, ${midY + pushY})`} role="img" aria-label={`Port ${port.ratio}:1 ${port.type}`}>
                                <circle r="14" fill="#34495e" stroke="#e2a248" strokeWidth="2" />
                                <text y="4" textAnchor="middle" fontSize="10" fill="white" fontWeight="bold">
                                    {port.type === 'any' ? '?' : TERRAIN_ICONS[port.type]}
                                </text>
                                <text y="-16" textAnchor="middle" fontSize="10" fill="#2c3e50" fontWeight="bold">
                                    {port.ratio}:1
                                </text>
                            </g>
                        );
                    })}
                </g>
            </svg>
            {viewBox && (
                <button className="reset-view-btn" onClick={resetView} title="Reset zoom">
                    ⊞
                </button>
            )}
        </div>
    );
}

export default HexBoard;
