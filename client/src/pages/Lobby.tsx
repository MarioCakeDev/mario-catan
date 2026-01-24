import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { useRoomActions } from '../hooks/useSocket';
import { getSocket } from '../socket/socket';
import type { Player, PlayerColor } from '@catan/shared';
import './Lobby.css';

const PLAYER_COLORS: PlayerColor[] = ['red', 'blue', 'green', 'orange', 'white', 'brown'];

function Lobby() {
    const { roomId } = useParams<{ roomId: string }>();
    const navigate = useNavigate();
    const { startGame, leaveRoom } = useRoomActions();

    const gameState = useGameStore(state => state.gameState);
    const playerId = useGameStore(state => state.playerId);
    const setGameState = useGameStore(state => state.setGameState);
    const players = gameState?.players || [];
    const isHost = players[0]?.id === playerId;
    const currentPlayer = players.find(p => p.id === playerId);

    const [selectedColor, setSelectedColor] = useState<PlayerColor | null>(null);

    // Get used colors
    const usedColors = new Set(players.map(p => p.color));

    useEffect(() => {
        const socket = getSocket();

        const handleRoomUpdated = (updatedPlayers: Player[]) => {
            console.log('Room updated, players:', updatedPlayers.map(p => p.name));
            const currentState = useGameStore.getState().gameState;
            if (currentState) {
                setGameState({
                    ...currentState,
                    players: updatedPlayers
                });
            }
        };

        socket.on('room:updated', handleRoomUpdated);

        return () => {
            socket.off('room:updated', handleRoomUpdated);
        };
    }, [setGameState]);

    // Set initial selected color from current player
    useEffect(() => {
        if (currentPlayer && !selectedColor) {
            setSelectedColor(currentPlayer.color);
        }
    }, [currentPlayer, selectedColor]);

    const handleLeave = () => {
        leaveRoom();
        navigate('/');
    };

    const handleStart = () => {
        if (players.length >= 3) {
            startGame();
        }
    };

    const copyRoomCode = () => {
        if (roomId) {
            navigator.clipboard.writeText(roomId);
        }
    };

    const handleColorSelect = (color: PlayerColor) => {
        if (!usedColors.has(color) || color === currentPlayer?.color) {
            setSelectedColor(color);
            // TODO: Emit color change to server
            const socket = getSocket();
            socket.emit('room:changeColor', color);
        }
    };

    return (
        <div className="page-center lobby-page">
            <div className="lobby-container fade-in">
                <div className="lobby-header">
                    <h1>Game Lobby</h1>
                    <button className="btn btn-secondary" onClick={handleLeave}>
                        Leave
                    </button>
                </div>

                <div className="room-code-display" onClick={copyRoomCode}>
                    <span className="room-code-label">Room Code</span>
                    <span className="room-code">{roomId}</span>
                    <span className="room-code-hint">Click to copy</span>
                </div>

                {/* Color selection */}
                <div className="color-selection">
                    <h3>Choose Your Color</h3>
                    <div className="color-options">
                        {PLAYER_COLORS.map(color => {
                            const isUsed = usedColors.has(color) && color !== currentPlayer?.color;
                            const isSelected = selectedColor === color;
                            return (
                                <button
                                    key={color}
                                    className={`color-btn ${isSelected ? 'selected' : ''} ${isUsed ? 'disabled' : ''}`}
                                    style={{
                                        backgroundColor: `var(--color-player-${color})`,
                                        opacity: isUsed ? 0.3 : 1
                                    }}
                                    onClick={() => handleColorSelect(color)}
                                    disabled={isUsed}
                                    title={isUsed ? 'Color taken' : color}
                                />
                            );
                        })}
                    </div>
                </div>

                <div className="players-section">
                    <h2>Players ({players.length}/4)</h2>
                    <div className="players-list">
                        {players.map((player, index) => (
                            <div
                                key={player.id}
                                className={`player-card ${player.id === playerId ? 'is-you' : ''} fade-in`}
                            >
                                <div
                                    className="player-color-indicator"
                                    style={{ backgroundColor: `var(--color-player-${player.color})` }}
                                />
                                <span className="player-name">
                                    {player.name}
                                    {index === 0 && <span className="host-badge">Host</span>}
                                    {player.id === playerId && <span className="you-badge">You</span>}
                                </span>
                                {player.isConnected ? (
                                    <span className="status-connected">●</span>
                                ) : (
                                    <span className="status-disconnected">○</span>
                                )}
                            </div>
                        ))}

                        {Array.from({ length: 4 - players.length }).map((_, i) => (
                            <div key={`empty-${i}`} className="player-card empty">
                                <div className="player-color-indicator empty-slot" />
                                <span className="player-name">Waiting for player...</span>
                            </div>
                        ))}
                    </div>
                </div>

                {isHost && (
                    <div className="lobby-actions">
                        <button
                            className="btn btn-primary btn-large"
                            onClick={handleStart}
                            disabled={players.length < 3}
                        >
                            {players.length < 3
                                ? `Need ${3 - players.length} more player${players.length < 2 ? 's' : ''}`
                                : '🎲 Start Game'
                            }
                        </button>
                    </div>
                )}

                {!isHost && (
                    <div className="waiting-message">
                        <div className="waiting-spinner" />
                        Waiting for host to start the game...
                    </div>
                )}
            </div>
        </div>
    );
}

export default Lobby;
