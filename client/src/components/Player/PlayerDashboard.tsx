import type { Player, ResourceType } from '@catan/shared';
import './PlayerDashboard.css';

interface PlayerDashboardProps {
    player: Player;
    allPlayers: Player[];
}

const RESOURCE_NAMES: Record<ResourceType, string> = {
    brick: 'Brick',
    lumber: 'Lumber',
    ore: 'Ore',
    wheat: 'Wheat',
    sheep: 'Sheep'
};

function ResourceCard({ type, count }: { type: ResourceType; count: number }) {
    return (
        <div className={`resource-card resource-${type}`}>
            <span className="resource-count">{count}</span>
            <span className="resource-name">{RESOURCE_NAMES[type]}</span>
        </div>
    );
}

function PlayerDashboard({ player, allPlayers }: PlayerDashboardProps) {
    const resources = Object.entries(player.resources) as [ResourceType, number][];

    return (
        <div className="player-dashboard">
            {/* Current player info */}
            <div className="dashboard-section">
                <div className="player-info">
                    <div className={`player-color player-${player.color}`}></div>
                    <span className="player-name">{player.name}</span>
                    <span className="victory-points">{player.victoryPoints} VP</span>
                </div>
            </div>

            {/* Resources */}
            <div className="dashboard-section">
                <h3 className="section-title">Resources</h3>
                <div className="resources-grid">
                    {resources.map(([type, count]) => (
                        <ResourceCard key={type} type={type} count={count} />
                    ))}
                </div>
            </div>

            {/* Development Cards */}
            {player.devCards.length > 0 && (
                <div className="dashboard-section">
                    <h3 className="section-title">Dev Cards ({player.devCards.length})</h3>
                    <div className="dev-cards-list">
                        {player.devCards.map((card, i) => (
                            <div key={i} className="dev-card">
                                {card.type}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Other players */}
            <div className="dashboard-section">
                <h3 className="section-title">Players</h3>
                <div className="other-players">
                    {allPlayers.map((p) => (
                        <div
                            key={p.id}
                            className={`other-player ${p.id === player.id ? 'is-you' : ''}`}
                        >
                            <div className={`player-color player-${p.color}`}></div>
                            <span className="player-name">{p.name}</span>
                            <span className="player-stats">
                                <span className="stat">{p.victoryPoints} VP</span>
                                <span className="stat">
                                    {Object.values(p.resources).reduce((a, b) => a + b, 0)} cards
                                </span>
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default PlayerDashboard;
