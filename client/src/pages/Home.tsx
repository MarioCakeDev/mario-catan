import { useState, KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRoomActions } from '../hooks/useSocket';
import { useGameStore } from '../store/gameStore';
import './Home.css';

function Home() {
    const navigate = useNavigate();
    const { createRoom, joinRoom } = useRoomActions();
    const isConnected = useGameStore(state => state.isConnected);

    const [playerName, setPlayerName] = useState('');
    const [roomCode, setRoomCode] = useState('');
    const [maxPlayers, setMaxPlayers] = useState<4 | 6>(4);
    const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleCreate = async () => {
        if (!playerName.trim()) {
            setError('Please enter your name');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const { roomId } = await createRoom(playerName.trim(), maxPlayers);
            navigate(`/room/${roomId}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create room');
        } finally {
            setLoading(false);
        }
    };

    const handleJoin = async () => {
        if (!playerName.trim()) {
            setError('Please enter your name');
            return;
        }
        if (!roomCode.trim()) {
            setError('Please enter room code');
            return;
        }

        setLoading(true);
        setError('');

        try {
            await joinRoom(roomCode.trim().toUpperCase(), playerName.trim());
            navigate(`/room/${roomCode.toUpperCase()}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to join room');
        } finally {
            setLoading(false);
        }
    };

    // Handle keyboard Enter key
    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, action: 'create' | 'join') => {
        if (e.key === 'Enter' && !loading) {
            if (action === 'create') {
                handleCreate();
            } else if (action === 'join' && roomCode.trim()) {
                handleJoin();
            }
        }
    };

    return (
        <div className="page-center home-page">
            <div className="home-container fade-in">
                <div className="home-logo">
                    <svg viewBox="0 0 100 100" className="logo-hex">
                        <polygon
                            points="50,5 90,27.5 90,72.5 50,95 10,72.5 10,27.5"
                            fill="var(--color-accent)"
                            stroke="var(--color-accent-dim)"
                            strokeWidth="3"
                        />
                        <text x="50" y="58" textAnchor="middle" fontSize="32" fontWeight="bold" fill="var(--color-bg-primary)">C</text>
                    </svg>
                    <h1 className="home-title">Catan</h1>
                    <p className="home-subtitle">Multiplayer Board Game</p>
                </div>

                {!isConnected && (
                    <div className="connection-status">
                        <span className="status-dot pulse"></span>
                        Connecting to server...
                    </div>
                )}

                {mode === 'menu' && (
                    <div className="home-menu">
                        <button
                            className="btn btn-primary btn-large"
                            onClick={() => setMode('create')}
                            disabled={!isConnected}
                        >
                            Create Game
                        </button>
                        <button
                            className="btn btn-secondary btn-large"
                            onClick={() => setMode('join')}
                            disabled={!isConnected}
                        >
                            Join Game
                        </button>
                    </div>
                )}

                {mode === 'create' && (
                    <div className="home-form">
                        <input
                            type="text"
                            className="input"
                            placeholder="Your Name"
                            value={playerName}
                            onChange={(e) => setPlayerName(e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, 'create')}
                            maxLength={20}
                            autoFocus
                        />

                        {/* Player count selection */}
                        <div className="player-count-selector">
                            <span className="selector-label">Players:</span>
                            <div className="selector-options">
                                <button
                                    className={`selector-btn ${maxPlayers === 4 ? 'active' : ''}`}
                                    onClick={() => setMaxPlayers(4)}
                                >
                                    3-4
                                </button>
                                <button
                                    className={`selector-btn ${maxPlayers === 6 ? 'active' : ''}`}
                                    onClick={() => setMaxPlayers(6)}
                                >
                                    5-6
                                </button>
                            </div>
                        </div>

                        {error && <p className="error-text">{error}</p>}
                        <div className="form-actions">
                            <button
                                className="btn btn-secondary"
                                onClick={() => { setMode('menu'); setError(''); }}
                            >
                                Back
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleCreate}
                                disabled={loading}
                            >
                                {loading ? 'Creating...' : 'Create Room'}
                            </button>
                        </div>
                        <p className="hint-text">Press Enter to create room</p>
                    </div>
                )}

                {mode === 'join' && (
                    <div className="home-form">
                        <input
                            type="text"
                            className="input"
                            placeholder="Your Name"
                            value={playerName}
                            onChange={(e) => setPlayerName(e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, 'join')}
                            maxLength={20}
                            autoFocus
                        />
                        <input
                            type="text"
                            className="input room-code-input"
                            placeholder="Room Code"
                            value={roomCode}
                            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                            onKeyDown={(e) => handleKeyDown(e, 'join')}
                            maxLength={6}
                        />
                        {error && <p className="error-text">{error}</p>}
                        <div className="form-actions">
                            <button
                                className="btn btn-secondary"
                                onClick={() => { setMode('menu'); setError(''); }}
                            >
                                Back
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleJoin}
                                disabled={loading}
                            >
                                {loading ? 'Joining...' : 'Join Room'}
                            </button>
                        </div>
                        <p className="hint-text">Press Enter to join room</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Home;
