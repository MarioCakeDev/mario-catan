import { useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useGameActions } from '../../hooks/useSocket';
import './MobilePlacementControls.css';

interface MobilePlacementControlsProps {
    onConfirm: () => void;
    onCancel: () => void;
    isValid: boolean;
    selectionType: 'road' | 'settlement' | 'city' | null;
}

export function MobilePlacementControls({
    onConfirm,
    onCancel,
    isValid,
    selectionType
}: MobilePlacementControlsProps) {
    // Prevent accidental background touches/scrolling when this is active
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
        };
    }, []);

    if (!selectionType) return null;

    return (
        <div className="mobile-placement-controls animate-slide-up">
            <div className="placement-info">
                <span className="placement-title">
                    Build {selectionType.charAt(0).toUpperCase() + selectionType.slice(1)}
                </span>
                <span className="placement-hint">
                    {isValid
                        ? "Tap 'Confirm' to build"
                        : "Tap a valid highlighted location"}
                </span>
            </div>

            <div className="placement-actions">
                <button
                    className="btn-cancel"
                    onClick={onCancel}
                    type="button"
                >
                    Cancel
                </button>

                <button
                    className={`btn-confirm ${isValid ? 'btn-pulse' : ''}`}
                    onClick={onConfirm}
                    disabled={!isValid}
                    type="button"
                >
                    Confirm
                </button>
            </div>
        </div>
    );
}
