import { useGameStore } from '../../store/gameStore';
import { useGameActions } from '../../hooks/useSocket';
import { BUILD_COSTS } from '@catan/shared';
import type { GamePhase, TurnPhase, Resources } from '@catan/shared';
import './ActionBar.css';

interface ActionBarProps {
    phase: GamePhase;
    turnPhase: TurnPhase;
    isMyTurn: boolean;
    onRollDice: () => void;
    onEndTurn: () => void;
    playerResources?: Resources;
}

function hasEnoughResources(resources: Resources | undefined, cost: Partial<Resources>): boolean {
    if (!resources) return false;
    return Object.entries(cost).every(([r, amount]) =>
        resources[r as keyof Resources] >= (amount || 0)
    );
}

function ActionBar({
    phase,
    turnPhase,
    isMyTurn,
    onRollDice,
    onEndTurn,
    playerResources
}: ActionBarProps) {
    const setBuildMode = useGameStore(state => state.setBuildMode);
    const buildMode = useGameStore(state => state.buildMode);
    const setShowTradeModal = useGameStore(state => state.setShowTradeModal);
    const { buyDevCard } = useGameActions();

    if (phase !== 'playing' && phase !== 'setup') {
        return null;
    }

    const canRoll = isMyTurn && turnPhase === 'roll';
    const canBuild = isMyTurn && turnPhase === 'main';
    const canEndTurn = isMyTurn && turnPhase === 'main';

    const canBuildSettlement = canBuild && hasEnoughResources(playerResources, BUILD_COSTS.settlement);
    const canBuildCity = canBuild && hasEnoughResources(playerResources, BUILD_COSTS.city);
    const canBuildRoad = canBuild && hasEnoughResources(playerResources, BUILD_COSTS.road);
    const canBuyDevCard = canBuild && hasEnoughResources(playerResources, BUILD_COSTS.devCard);

    return (
        <div className="action-bar">
            {!isMyTurn && (
                <div className="waiting-indicator">
                    Waiting for other player...
                </div>
            )}

            {canRoll && (
                <button className="btn btn-primary action-btn" onClick={onRollDice}>
                    Roll Dice
                </button>
            )}

            {canBuild && (
                <div className="build-actions">
                    <button
                        className={`btn btn-secondary action-btn ${buildMode === 'road' ? 'active' : ''}`}
                        onClick={() => setBuildMode(buildMode === 'road' ? null : 'road')}
                        disabled={!canBuildRoad}
                        title="1 Brick + 1 Lumber"
                    >
                        Road
                    </button>
                    <button
                        className={`btn btn-secondary action-btn ${buildMode === 'settlement' ? 'active' : ''}`}
                        onClick={() => setBuildMode(buildMode === 'settlement' ? null : 'settlement')}
                        disabled={!canBuildSettlement}
                        title="1 Brick + 1 Lumber + 1 Wheat + 1 Sheep" // Fixed resource names
                    >
                        Settlement
                    </button>
                    <button
                        className={`btn btn-secondary action-btn ${buildMode === 'city' ? 'active' : ''}`}
                        onClick={() => setBuildMode(buildMode === 'city' ? null : 'city')}
                        disabled={!canBuildCity}
                        title="3 Ore + 2 Wheat" // Fixed resource names
                    >
                        City
                    </button>
                    <button
                        className="btn btn-secondary action-btn"
                        onClick={buyDevCard}
                        disabled={!canBuyDevCard}
                        title="1 Ore + 1 Wheat + 1 Sheep" // Fixed resource names
                    >
                        Dev Card
                    </button>
                    <button
                        className="btn btn-secondary action-btn"
                        onClick={() => setShowTradeModal(true)}
                    >
                        Trade
                    </button>
                </div>
            )}

            {canEndTurn && (
                <button className="btn btn-primary action-btn" onClick={onEndTurn}>
                    End Turn
                </button>
            )}
        </div>
    );
}

export default ActionBar;
