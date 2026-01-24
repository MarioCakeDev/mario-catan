import type { PlayerColor } from '@catan/shared';
import './TurnIndicator.css';

interface TurnIndicatorProps {
    playerName: string;
    playerColor: PlayerColor;
    isYourTurn: boolean;
}

function TurnIndicator({ playerName, playerColor, isYourTurn }: TurnIndicatorProps) {
    return (
        <div className={`turn-indicator ${isYourTurn ? 'your-turn' : ''}`}>
            <div className={`player-color player-${playerColor}`}></div>
            <span className="turn-text">
                {isYourTurn ? 'Your Turn' : `${playerName}'s Turn`}
            </span>
        </div>
    );
}

export default TurnIndicator;
