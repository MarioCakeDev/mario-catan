import { useState, useEffect } from 'react';
import './DiceDisplay.css';

interface DiceDisplayProps {
    dice: [number, number] | null;
    canRoll: boolean;
    onRoll: () => void;
    isRolling?: boolean;
}

function DiceFace({ value, isRolling }: { value: number; isRolling?: boolean }) {
    // Create dot positions for a die face
    const dots: { cx: number; cy: number }[] = [];

    if (value === 1 || value === 3 || value === 5) {
        dots.push({ cx: 25, cy: 25 }); // center
    }
    if (value >= 2) {
        dots.push({ cx: 12, cy: 12 }); // top-left
        dots.push({ cx: 38, cy: 38 }); // bottom-right
    }
    if (value >= 4) {
        dots.push({ cx: 38, cy: 12 }); // top-right
        dots.push({ cx: 12, cy: 38 }); // bottom-left
    }
    if (value === 6) {
        dots.push({ cx: 12, cy: 25 }); // middle-left
        dots.push({ cx: 38, cy: 25 }); // middle-right
    }

    return (
        <svg className={`die ${isRolling ? 'rolling' : ''}`} viewBox="0 0 50 50" width="60" height="60">
            <defs>
                <linearGradient id="dieGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fafafa" />
                    <stop offset="100%" stopColor="#e0e0e0" />
                </linearGradient>
                <filter id="dieShadow">
                    <feDropShadow dx="2" dy="2" stdDeviation="2" floodOpacity="0.3" />
                </filter>
            </defs>
            <rect
                x="3" y="3"
                width="44" height="44"
                rx="8"
                fill="url(#dieGradient)"
                stroke="#bbb"
                strokeWidth="1"
                filter="url(#dieShadow)"
            />
            {dots.map((dot, i) => (
                <circle
                    key={i}
                    cx={dot.cx}
                    cy={dot.cy}
                    r="5"
                    fill="#1a1a2e"
                    className="die-dot"
                />
            ))}
        </svg>
    );
}

function DiceDisplay({ dice, canRoll, onRoll, isRolling = false }: DiceDisplayProps) {
    const [animatedDice, setAnimatedDice] = useState<[number, number]>([1, 1]);
    const [rolling, setRolling] = useState(false);

    useEffect(() => {
        if (isRolling) {
            setRolling(true);
            // Animate random dice during roll
            const interval = setInterval(() => {
                setAnimatedDice([
                    Math.floor(Math.random() * 6) + 1,
                    Math.floor(Math.random() * 6) + 1
                ]);
            }, 100);

            return () => clearInterval(interval);
        } else if (dice) {
            setRolling(false);
            setAnimatedDice(dice);
        }
    }, [isRolling, dice]);

    const displayDice = rolling ? animatedDice : (dice || [1, 1]);
    const total = dice ? dice[0] + dice[1] : null;
    const isCritical = total === 7;

    const handleClick = () => {
        if (canRoll && !rolling) {
            setRolling(true);
            // Animate for 1 second before calling onRoll
            setTimeout(() => {
                onRoll();
                setTimeout(() => setRolling(false), 200);
            }, 800);
        }
    };

    return (
        <div
            className={`dice-display ${canRoll ? 'clickable' : ''} ${isCritical ? 'dice-critical' : ''} ${rolling ? 'is-rolling' : ''}`}
            onClick={handleClick}
        >
            <div className="dice-container">
                <DiceFace value={displayDice[0]} isRolling={rolling} />
                <DiceFace value={displayDice[1]} isRolling={rolling} />
            </div>

            {total !== null && !rolling && (
                <div className={`dice-total ${isCritical ? 'critical' : ''}`}>
                    {total}
                </div>
            )}

            {canRoll && !rolling && (
                <div className="dice-hint">
                    Click to roll!
                </div>
            )}

            {rolling && (
                <div className="dice-rolling-text">
                    Rolling...
                </div>
            )}
        </div>
    );
}

export default DiceDisplay;
