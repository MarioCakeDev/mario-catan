import { Routes, Route } from 'react-router-dom';
import { useGameStore } from './store/gameStore';
import { useSocketConnection } from './hooks/useSocket';
import Home from './pages/Home';
import Lobby from './pages/Lobby';
import Game from './pages/Game';

function App() {
    // Initialize socket connection
    useSocketConnection();

    const phase = useGameStore(state => state.gameState?.phase);

    return (
        <div className="app">
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/room/:roomId" element={
                    phase === 'lobby' ? <Lobby /> : <Game />
                } />
            </Routes>
        </div>
    );
}

export default App;
