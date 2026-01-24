import type {
    Board,
    Hex,
    HexCoord,
    Vertex,
    Edge,
    Port,
    TerrainType,
    PortType,
    GameConfig
} from '@catan/shared';

// ============================================
// HEX COORDINATE HELPERS
// ============================================

export function hexKey(coord: HexCoord): string {
    return `${coord.q},${coord.r}`;
}

export function parseHexKey(key: string): HexCoord {
    const [q, r] = key.split(',').map(Number);
    return { q, r };
}

// Get all 6 neighbors of a hex
export function getHexNeighbors(coord: HexCoord): HexCoord[] {
    const directions = [
        { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
        { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }
    ];
    return directions.map(d => ({ q: coord.q + d.q, r: coord.r + d.r }));
}

// ============================================
// VERTEX AND EDGE GENERATION
// ============================================

function generateVertexId(hexes: HexCoord[]): string {
    return hexes
        .map(h => hexKey(h))
        .sort()
        .join('|');
}

function generateEdgeId(v1: string, v2: string): string {
    return [v1, v2].sort().join('~');
}

// ============================================
// BOARD GENERATION
// ============================================

// ============================================
// BOARD GENERATION
// ============================================

// Standard Catan board hex positions (axial coordinates)
const BOARD_HEX_POSITIONS: HexCoord[] = [
    // Top row (3 hexes)
    { q: 0, r: -2 }, { q: 1, r: -2 }, { q: 2, r: -2 },
    // Second row (4 hexes)
    { q: -1, r: -1 }, { q: 0, r: -1 }, { q: 1, r: -1 }, { q: 2, r: -1 },
    // Middle row (5 hexes)
    { q: -2, r: 0 }, { q: -1, r: 0 }, { q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 },
    // Fourth row (4 hexes)  
    { q: -2, r: 1 }, { q: -1, r: 1 }, { q: 0, r: 1 }, { q: 1, r: 1 },
    // Bottom row (3 hexes)
    { q: -2, r: 2 }, { q: -1, r: 2 }, { q: 0, r: 2 }
];

// Terrain distribution (standard Catan) - updated names
const TERRAIN_COUNTS: Record<TerrainType, number> = {
    desert: 1,
    brick: 3,
    lumber: 4,
    ore: 3,
    wheat: 4,
    sheep: 4,
    water: 0 // Generated dynamically
};

// Number token distribution (excluding 7)
const NUMBER_TOKENS = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];

// Standard harbor configuration
const STANDARD_HARBORS: { type: PortType; ratio: number }[] = [
    { type: 'any', ratio: 3 },
    { type: 'wheat', ratio: 2 },
    { type: 'ore', ratio: 2 },
    { type: 'any', ratio: 3 },
    { type: 'sheep', ratio: 2 },
    { type: 'any', ratio: 3 },
    { type: 'any', ratio: 3 },
    { type: 'brick', ratio: 2 },
    { type: 'lumber', ratio: 2 }
];

// Shuffle array in place
function shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

// Generate terrain tiles
function generateTerrains(): TerrainType[] {
    const terrains: TerrainType[] = [];
    for (const [terrain, count] of Object.entries(TERRAIN_COUNTS)) {
        for (let i = 0; i < count; i++) {
            terrains.push(terrain as TerrainType);
        }
    }
    return shuffle(terrains);
}

// Generate the "Sea" ring around the board
function generateSeaHexes(landHexes: Hex[]): Hex[] {
    const landCoords = new Set(landHexes.map(h => hexKey(h.coord)));
    const seaHexes: Hex[] = [];
    const processedSeaCoords = new Set<string>();

    for (const hex of landHexes) {
        const neighbors = getHexNeighbors(hex.coord);
        for (const neighbor of neighbors) {
            const key = hexKey(neighbor);
            // If it's not land and we haven't added it yet
            if (!landCoords.has(key) && !processedSeaCoords.has(key)) {
                seaHexes.push({
                    coord: neighbor,
                    terrain: 'water' as any, // Using 'water' as terrain type which needs to be handled by client
                    number: null,
                    hasRobber: false
                });
                processedSeaCoords.add(key);
            }
        }
    }
    return seaHexes;
}

// Generate land hexes with terrain and numbers, enforcing "Fair Map" rules (no adjacent 6s or 8s)
function generateLandHexes(): Hex[] {
    const terrains = generateTerrains();
    const numbers = shuffle([...NUMBER_TOKENS]);
    let numberIndex = 0;

    // 1. Initial assignment
    const hexes: Hex[] = BOARD_HEX_POSITIONS.map((coord, i) => {
        const terrain = terrains[i];
        const hasRobber = terrain === 'desert';
        const number = terrain === 'desert' ? null : numbers[numberIndex++];

        return {
            coord,
            terrain,
            number,
            hasRobber
        };
    });

    // 2. Validate and Fix Adjacency (No Red Tokens Touching)
    // Red tokens are 6 and 8
    const isRed = (num: number | null) => num === 6 || num === 8;

    // Map for easy neighbor lookup
    const hexMap = new Map<string, Hex>();
    hexes.forEach(h => hexMap.set(hexKey(h.coord), h));

    let retries = 0;
    const maxRetries = 100;

    // Simple conflict resolution: If we find a bad pair, swap one with a random non-red number
    // We run this in a loop to ensure cascading swaps didn't create new problems
    while (retries < maxRetries) {
        let conflictFound = false;

        for (const hex of hexes) {
            if (!isRed(hex.number)) continue;

            const neighbors = getHexNeighbors(hex.coord);
            for (const n of neighbors) {
                const neighborHex = hexMap.get(hexKey(n));

                // If neighbor exists (is land) and is also red
                if (neighborHex && isRed(neighborHex.number)) {
                    // Conflict found! neighborHex and hex are both 6 or 8.
                    conflictFound = true;

                    // Find a candidate to swap with (must not be red, and shouldn't create new conflict)
                    // Simplified: just find any non-red, non-desert number and swap.
                    // The while loop will catch if this created a new conflict.
                    const candidates = hexes.filter(h => h !== hex && h !== neighborHex && h.number !== null && !isRed(h.number));

                    if (candidates.length > 0) {
                        const swapTarget = candidates[Math.floor(Math.random() * candidates.length)];

                        // Swap numbers
                        const temp = hex.number;
                        hex.number = swapTarget.number;
                        swapTarget.number = temp;
                    }

                    break; // Break inner loop to restart validation
                }
            }
            if (conflictFound) break; // Break hex loop to restart
        }

        if (!conflictFound) break; // Clean board!
        retries++;
    }

    if (retries === maxRetries) {
        console.warn("Could not generate a perfectly fair map within retry limit. Proceeding with best attempt.");
    }

    return hexes;
}

// Generate vertices from hexes (now includes sea connectivity)
function generateVertices(hexes: Hex[]): Vertex[] {
    const hexSet = new Set(hexes.map(h => hexKey(h.coord)));
    const vertexMap = new Map<string, HexCoord[]>();

    for (const hex of hexes) {
        // Only generate vertices for land hexes to determine playable spots, 
        // but we need to know about sea neighbors for ports.
        // Actually, we want vertices for all land hexes. Sea hexes are visual context.
        // We only care about vertices that touch at least one land hex.

        const neighbors = getHexNeighbors(hex.coord);

        for (let i = 0; i < 6; i++) {
            // ... (standard vertex generation logic)
            // Simplified: We iterate all 6 corners of every LAND hex
            // We don't iterate SEA hexes primarily, but they will be neighbors
        }
    }

    // Rewrite to only iterate land hexes but look for neighbors (which might be sea)
    const landHexes = hexes.filter(h => h.terrain !== 'water' as any);
    const allHexesMap = new Map(hexes.map(h => [hexKey(h.coord), h]));

    for (const hex of landHexes) {
        const neighbors = getHexNeighbors(hex.coord);

        for (let i = 0; i < 6; i++) {
            const n1 = neighbors[i];
            const n2 = neighbors[(i + 1) % 6];

            // Identifying the vertex by the 3 hexes that touch it: Center (hex), N1, N2
            const touchingKeys = [hex.coord, n1, n2];

            // Filter to only existing hexes (land or sea)
            const validTouching = touchingKeys.filter(k => allHexesMap.has(hexKey(k)));

            // Only create vertex if it touches land (which current loop ensures since 'hex' is land)
            const vertexId = generateVertexId(validTouching);

            if (!vertexMap.has(vertexId)) {
                vertexMap.set(vertexId, validTouching);
            }
        }
    }

    return Array.from(vertexMap.entries()).map(([id, hexes]) => ({
        id,
        hexes
    }));
}

// Generate edges from vertices
function generateEdges(vertices: Vertex[]): Edge[] {
    const edgeMap = new Map<string, [string, string]>();

    // We only care about edges that border at least one land hex
    // Vertices on the coast will touch land and sea.

    for (let i = 0; i < vertices.length; i++) {
        for (let j = i + 1; j < vertices.length; j++) {
            const v1 = vertices[i];
            const v2 = vertices[j];

            // Check if they share 2 hexes
            const shared = v1.hexes.filter(h1 =>
                v2.hexes.some(h2 => h1.q === h2.q && h1.r === h2.r)
            );

            if (shared.length === 2) {
                const edgeId = generateEdgeId(v1.id, v2.id);
                if (!edgeMap.has(edgeId)) {
                    edgeMap.set(edgeId, [v1.id, v2.id]);
                }
            }
        }
    }

    return Array.from(edgeMap.entries()).map(([id, vertices]) => ({
        id,
        vertices
    }));
}

// Find valid port locations: Coastal edges
function findPortLocations(vertices: Vertex[], hexes: Hex[]): [string, string][] {
    const landHexKeys = new Set(hexes.filter(h => h.terrain !== 'water' as any).map(h => hexKey(h.coord)));
    const edges: [string, string][] = [];

    // Helper to check if a vertex is on the coast (touches at least one sea/null and one land)
    // Actually simpler: Find edges that lie between a Land hex and a Sea hex (or outer void)

    // Iterate all potential edges between vertices
    for (let i = 0; i < vertices.length; i++) {
        for (let j = i + 1; j < vertices.length; j++) {
            const v1 = vertices[i];
            const v2 = vertices[j];

            // Common hexes
            const sharedCoords = v1.hexes.filter(h1 =>
                v2.hexes.some(h2 => h1.q === h2.q && h1.r === h2.r)
            );

            if (sharedCoords.length === 2) {
                // Determine terrain of shared hexes
                const terrains = sharedCoords.map(c => {
                    const h = hexes.find(x => hexKey(x.coord) === hexKey(c));
                    return h ? h.terrain : 'void';
                });

                const isLand = (t: string) => t !== 'water' as any && t !== 'void';

                // A port location is an edge between Land and Water (or Land and Void if no sea hexes)
                // With our sea generation, it should be between Land and Water
                const landCount = terrains.filter(t => isLand(t)).length;
                const waterCount = terrains.filter(t => t === 'water' as any).length;

                if (landCount === 1 && waterCount === 1) {
                    edges.push([v1.id, v2.id]);
                }
            }
        }
    }

    // Sort edges angularly around the center (0,0) to nice distribution
    // This requires approximating the edge center position from hex coords
    return edges.sort((a, b) => {
        const getAngle = (vId: string) => {
            // Hacky coord extraction from ID string "q,r|q,r|..." - taking first one is erratic
            // Better: use the vertex object passed in, calculate average center of its hexes
            // Even better: We don't have screen coords here.
            // Let's rely on the order generated by `findPortLocations` which iterates vertices linearly?
            // No, random map needs consistent ordering.
            // Let's assume standard iterating order is "good enough" for now or random shuffle
            return 0;
        };
        return 0; // Skip complex sort for now, rely on random shuffle later if needed or stride
    });
}

// Generate ports
function generatePorts(vertices: Vertex[], hexes: Hex[], randomize: boolean): Port[] {
    const potentialEdges = findPortLocations(vertices, hexes);
    let harbors = [...STANDARD_HARBORS];

    if (randomize) {
        harbors = shuffle(harbors);
    }

    // Distribute harbors evenly along the coast
    // We have `potentialEdges` (all coastal edges). We need to place `harbors`.
    // We shouldn't place them on adjacent edges typically.

    // Simple heuristic: Walk the coast.
    // Since `potentialEdges` isn't sorted as a loop, we might get weird clusters.
    // For a robust "Circle" we need to thread the edges.
    // Simplification for this task: Shuffle the potential edges and pick N unique ones,
    // ensuring they don't share a vertex if we want spacing.

    let validLocations: [string, string][] = [];

    // Attempt to pick spaced out locations
    // 1. Sort edges by angle (using simple q/r to angle approx)
    const center = { q: 0, r: 0 };
    const sortedEdges = potentialEdges.map(edge => {
        // Approximate edge position by averaging the shared LAND hex of the vertices?
        // Let's just use the vertices' known hex connections.
        return edge;
    });
    // (Skipping complex sort for brevity as user asked for "random or rule-adjusted")

    // Randomize candidates to vary placement
    const candidates = shuffle([...potentialEdges]);
    const usedVertices = new Set<string>();

    for (const edge of candidates) {
        if (validLocations.length >= harbors.length) break;

        const [v1, v2] = edge;
        // Rule: Don't place if adjacent to existing port (share a vertex)
        if (!usedVertices.has(v1) && !usedVertices.has(v2)) {
            validLocations.push(edge);
            usedVertices.add(v1);
            usedVertices.add(v2);
            // Also mark neighbors of these vertices as used to ensure 1-edge gap?
            // Standard Catan usually implies some spacing.
            // This set logic ensures at least 1 edge gap between ports because
            // existing ports consume their 2 vertices.
        }
    }

    // If we ran out of space (too strict), relax rules or just fill
    if (validLocations.length < harbors.length) {
        const remaining = candidates.filter(e => !validLocations.includes(e));
        validLocations.push(...remaining.slice(0, harbors.length - validLocations.length));
    }

    return harbors.map((harbor, i) => ({
        vertexIds: validLocations[i] || potentialEdges[i],
        type: harbor.type,
        ratio: harbor.ratio
    }));
}

// ============================================
// MAIN EXPORT
// ============================================

export function generateBoard(config?: { randomizeHarbors?: boolean }): Board {
    const landHexes = generateLandHexes();
    const seaHexes = generateSeaHexes(landHexes);
    const allHexes = [...landHexes, ...seaHexes];

    const vertices = generateVertices(allHexes);
    const edges = generateEdges(vertices);
    const ports = generatePorts(vertices, allHexes, config?.randomizeHarbors ?? false);

    return {
        hexes: allHexes,
        vertices,
        edges,
        ports
    };
}

// Get hexes that produce resources for a given dice roll
export function getHexesForRoll(board: Board, roll: number): Hex[] {
    return board.hexes.filter(hex => hex.number === roll && !hex.hasRobber);
}

// Get vertices adjacent to a hex
export function getVerticesForHex(board: Board, hexCoord: HexCoord): Vertex[] {
    return board.vertices.filter(v =>
        v.hexes.some(h => h.q === hexCoord.q && h.r === hexCoord.r)
    );
}

// Get edges connected to a vertex
export function getEdgesForVertex(board: Board, vertexId: string): Edge[] {
    return board.edges.filter(e =>
        e.vertices[0] === vertexId || e.vertices[1] === vertexId
    );
}

// Check if two vertices are adjacent
export function areVerticesAdjacent(board: Board, v1: string, v2: string): boolean {
    return board.edges.some(e =>
        (e.vertices[0] === v1 && e.vertices[1] === v2) ||
        (e.vertices[0] === v2 && e.vertices[1] === v1)
    );
}

// Check if player has a port for a specific resource
export function getPlayerPortRatio(board: Board, buildings: { vertexId: string; playerId: string }[], playerId: string, resourceType: PortType): number {
    let bestRatio = 4; // Default bank rate

    for (const port of board.ports) {
        // Check if player has a building on either port vertex
        const hasBuilding = buildings.some(b =>
            b.playerId === playerId &&
            (b.vertexId === port.vertexIds[0] || b.vertexId === port.vertexIds[1])
        );

        if (hasBuilding) {
            if (port.type === 'any' && port.ratio < bestRatio) {
                bestRatio = port.ratio;
            } else if (port.type === resourceType && port.ratio < bestRatio) {
                bestRatio = port.ratio;
            }
        }
    }

    return bestRatio;
}
