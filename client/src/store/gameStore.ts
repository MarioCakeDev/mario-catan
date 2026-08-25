import { create } from 'zustand';
import type { GameState, ChatMessage } from '@catan/shared';

interface GameStore {
    // Connection state
    isConnected: boolean;
    playerId: string | null;
    playerName: string | null;
    roomId: string | null;

    // Game state (from server)
    gameState: GameState | null;

    // UI state
    selectedVertex: string | null;
    selectedEdge: string | null;
    buildMode: 'settlement' | 'city' | 'road' | null;
    showTradeModal: boolean;
    chatMessages: ChatMessage[];

    // Actions
    setConnected: (connected: boolean) => void;
    setPlayerInfo: (playerId: string, playerName: string, roomId: string) => void;
    setGameState: (state: GameState) => void;
    updateGameState: (state: Partial<GameState>) => void;
    setSelectedVertex: (vertexId: string | null) => void;
    setSelectedEdge: (edgeId: string | null) => void;
    setBuildMode: (mode: 'settlement' | 'city' | 'road' | null) => void;
    setShowTradeModal: (show: boolean) => void;
    addChatMessage: (message: ChatMessage) => void;
    reset: () => void;
}

const initialState = {
    isConnected: false,
    playerId: localStorage.getItem('catan_playerId') || null,
    playerName: localStorage.getItem('catan_playerName') || null,
    roomId: localStorage.getItem('catan_roomId') || null,
    gameState: null,
    selectedVertex: null,
    selectedEdge: null,
    buildMode: null,
    showTradeModal: false,
    chatMessages: []
};

export const useGameStore = create<GameStore>((set) => ({
    ...initialState,

    setConnected: (isConnected) => set({ isConnected }),

    setPlayerInfo: (playerId, playerName, roomId) => {
        localStorage.setItem('catan_playerId', playerId);
        localStorage.setItem('catan_playerName', playerName);
        localStorage.setItem('catan_roomId', roomId);
        set({ playerId, playerName, roomId });
    },

    setGameState: (gameState) => set({ gameState }),

    updateGameState: (partial) =>
        set((state) => ({
            gameState: state.gameState ? { ...state.gameState, ...partial } : null
        })),

    setSelectedVertex: (selectedVertex) => set({ selectedVertex }),

    setSelectedEdge: (selectedEdge) => set({ selectedEdge }),

    setBuildMode: (buildMode) => set({ buildMode, selectedVertex: null, selectedEdge: null }),

    setShowTradeModal: (showTradeModal) => set({ showTradeModal }),

    addChatMessage: (message) =>
        set((state) => ({
            chatMessages: [...state.chatMessages.slice(-99), message]
        })),

    reset: () => {
        localStorage.removeItem('catan_playerId');
        localStorage.removeItem('catan_playerName');
        localStorage.removeItem('catan_roomId');
        set(initialState);
    }
}));

// Selectors for common queries
export const useCurrentPlayer = () => useGameStore((state) => {
    if (!state.gameState || !state.playerId) return null;
    return state.gameState.players.find(p => p.id === state.playerId);
});

export const useIsMyTurn = () => useGameStore((state) => {
    if (!state.gameState || !state.playerId) return false;
    return state.gameState.currentPlayerId === state.playerId;
});

export const useOtherPlayers = () => useGameStore((state) => {
    if (!state.gameState || !state.playerId) return [];
    return state.gameState.players.filter(p => p.id !== state.playerId);
});
