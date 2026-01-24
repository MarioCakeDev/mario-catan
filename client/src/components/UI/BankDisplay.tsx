import type { Resources } from '@catan/shared';
import './BankDisplay.css';

interface BankDisplayProps {
    remainingResources?: Partial<Resources>;
    remainingDevCards?: number;
}

// Standard Catan bank amounts
const INITIAL_BANK: Resources = {
    brick: 19,
    lumber: 19,
    ore: 19,
    wheat: 19,
    sheep: 19
};

const RESOURCE_ICONS: Record<keyof Resources, string> = {
    brick: '🧱',
    lumber: '🌲',
    ore: '⛏️',
    wheat: '🌾',
    sheep: '🐑'
};

function BankDisplay({ remainingResources, remainingDevCards = 25 }: BankDisplayProps) {
    const resources = remainingResources || INITIAL_BANK;

    return (
        <div className="bank-display">
            <h3 className="bank-title">🏦 Bank</h3>

            <div className="bank-resources">
                {(Object.keys(RESOURCE_ICONS) as (keyof Resources)[]).map(resource => (
                    <div key={resource} className="bank-resource">
                        <span className="resource-icon">{RESOURCE_ICONS[resource]}</span>
                        <span className="resource-count">{resources[resource] || 0}</span>
                    </div>
                ))}
            </div>

            <div className="bank-dev-cards">
                <span className="dev-card-icon">🃏</span>
                <span className="dev-card-count">{remainingDevCards}</span>
                <span className="dev-card-label">Dev Cards</span>
            </div>
        </div>
    );
}

export default BankDisplay;
