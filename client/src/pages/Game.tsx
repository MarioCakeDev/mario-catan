import { useState } from 'react';
import { useGameStore, useCurrentPlayer, useIsMyTurn } from '../store/gameStore';
import { useGameActions } from '../hooks/useSocket';
import HexBoard from '../components/Board/HexBoard';
import PlayerDashboard from '../components/Player/PlayerDashboard';
import BankDisplay from '../components/UI/BankDisplay';
import ActionBar from '../components/UI/ActionBar';
import DiceDisplay from '../components/UI/DiceDisplay';
import TurnIndicator from '../components/UI/TurnIndicator';
import './Game.css';

function Game() {
    const gameState = useGameStore(state => state.gameState);
    const currentPlayer = useCurrentPlayer();
    const isMyTurn = useIsMyTurn();
    const { rollDice, endTurn } = useGameActions();
    const [isRolling, setIsRolling] = useState(false);

    if (!gameState) {
        return (
            <div className="page-center">
                <div className="loading-spinner" />
                <p>Loading game...</p>
            </div>
        );
    }

    const currentTurnPlayer = gameState.players.find(p => p.id === gameState.currentPlayerId);
    const canRoll = isMyTurn && gameState.turnPhase === 'roll' && gameState.phase === 'playing';

    const handleRollDice = () => {
        setIsRolling(true);
        rollDice();
        setTimeout(() => setIsRolling(false), 500);
    };

    return (
        <div className="game-page">
            <header className="game-header">
                <TurnIndicator
                    playerName={currentTurnPlayer?.name || ''}
                    playerColor={currentTurnPlayer?.color || 'red'}
                    isYourTurn={isMyTurn}
                />

                <div className="header-center">
                    <div className="phase-indicator">
                        {gameState.phase === 'setup' && <span>🏗️ Setup Phase</span>}
                        {gameState.phase === 'playing' && <span>🎲 Turn {gameState.turnNumber}</span>}
                    </div>
                </div>

                <DiceDisplay
                    dice={gameState.diceRoll}
                    canRoll={canRoll}
                    onRoll={handleRollDice}
                    isRolling={isRolling}
                />
            </header>

            <main className="game-main">
                <aside className="game-sidebar-left">
                    <BankDisplay remainingDevCards={gameState.devCardDeck.length} />
                </aside>

                <div className="board-container">
                    <HexBoard
                        board={gameState.board}
                        buildings={gameState.buildings}
                        roads={gameState.roads}
                    />
                </div>

                <aside className="game-sidebar-right">
                    {currentPlayer && (
                        <PlayerDashboard
                            player={currentPlayer}
                            allPlayers={gameState.players}
                        />
                    )}
                </aside>
            </main>

            <footer className="game-footer">
                <ActionBar
                    phase={gameState.phase}
                    turnPhase={gameState.turnPhase}
                    isMyTurn={isMyTurn}
                    onRollDice={handleRollDice}
                    onEndTurn={endTurn}
                    playerResources={currentPlayer?.resources}
                />
            </footer>

            {gameState.winnerId && (
                <div className="game-over-overlay">
                    <div className="game-over-modal">
                        <h2>🎉 Victory!</h2>
                        <p className="winner-name">
                            {gameState.players.find(p => p.id === gameState.winnerId)?.name} wins!
                        </p>
                        <button className="btn btn-primary" onClick={() => window.location.href = '/'}>
                            Return Home
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Game;
