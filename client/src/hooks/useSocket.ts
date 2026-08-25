import { useEffect, useCallback } from 'react';
import { useGameStore } from '../store/gameStore';
import { getSocket, connectSocket } from '../socket/socket';
import type { Player, GameState, ResourceType, DevCardPayload } from '@catan/shared';

export function useSocketConnection() {
    const setConnected = useGameStore(state => state.setConnected);
    const setGameState = useGameStore(state => state.setGameState);
    const addChatMessage = useGameStore(state => state.addChatMessage);

    useEffect(() => {
        const socket = getSocket();

        const handleConnect = () => {
            console.log('Connected to server');
            setConnected(true);
        };

        const handleDisconnect = () => {
            console.log('Disconnected from server');
            setConnected(false);
        };

        const handleRoomUpdated = (updatedPlayers: Player[]) => {
            const currentState = useGameStore.getState().gameState;
            if (currentState) {
                setGameState({
                    ...currentState,
                    players: updatedPlayers
                });
            }
        };

        const handleGameStarted = (state: GameState) => {
            console.log('Game started');
            setGameState(state);
        };

        const handleStateUpdate = (state: GameState) => {
            setGameState(state);
            // Clear build mode when state updates (e.g., after placing)
            useGameStore.getState().setBuildMode(null);
        };

        const handleGameEnded = (winnerId: string) => {
            console.log('Game ended, winner:', winnerId);
        };

        const handleDiceRolled = (dice: [number, number], _playerId: string) => {
            console.log(`Player rolled ${dice[0]} + ${dice[1]} = ${dice[0] + dice[1]}`);
        };

        const handleChatMessage = (message: { id?: string; playerId: string; playerName: string; message: string; timestamp: number; isSystem?: boolean }) => {
            addChatMessage({
                id: message.id || `msg_${Date.now()}_${Math.random()}`,
                isSystem: message.isSystem || false,
                ...message
            });
        };

        const handleActionError = (error: { action: string; message: string; code: string }) => {
            console.error('Action error:', error.action, error.message);
            // Could show toast notification here
        };

        // Register listeners
        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);
        socket.on('room:updated', handleRoomUpdated);
        socket.on('game:started', handleGameStarted);
        socket.on('game:stateUpdate', handleStateUpdate);
        socket.on('game:ended', handleGameEnded);
        socket.on('turn:diceRolled', handleDiceRolled);
        socket.on('chat:message', handleChatMessage);
        socket.on('action:error', handleActionError);

        // Connect
        connectSocket();

        // Cleanup
        return () => {
            socket.off('connect', handleConnect);
            socket.off('disconnect', handleDisconnect);
            socket.off('room:updated', handleRoomUpdated);
            socket.off('game:started', handleGameStarted);
            socket.off('game:stateUpdate', handleStateUpdate);
            socket.off('game:ended', handleGameEnded);
            socket.off('turn:diceRolled', handleDiceRolled);
            socket.off('chat:message', handleChatMessage);
            socket.off('action:error', handleActionError);
        };
    }, [setConnected, setGameState, addChatMessage]);
}

// CRITICAL FIX: Use getState() at action time to avoid stale closures
export function useGameActions() {
    const socket = getSocket();

    // All actions now get fresh state when called, not when hook is created
    return {
        rollDice: useCallback(() => {
            const { gameState, playerId } = useGameStore.getState();
            if (gameState?.currentPlayerId === playerId) {
                socket.emit('game:rollDice');
            }
        }, [socket]),

        buildSettlement: useCallback((vertexId: string) => {
            socket.emit('game:buildSettlement', vertexId);
        }, [socket]),

        buildCity: useCallback((vertexId: string) => {
            socket.emit('game:buildCity', vertexId);
        }, [socket]),

        buildRoad: useCallback((edgeId: string) => {
            socket.emit('game:buildRoad', edgeId);
        }, [socket]),

        buyDevCard: useCallback(() => {
            const { gameState, playerId } = useGameStore.getState();
            if (gameState?.currentPlayerId === playerId && gameState?.turnPhase === 'main') {
                socket.emit('game:buyDevCard');
            }
        }, [socket]),

        playDevCard: useCallback((cardIndex: number, payload?: DevCardPayload) => {
            socket.emit('game:playDevCard', cardIndex, payload);
        }, [socket]),

        endTurn: useCallback(() => {
            const { gameState, playerId } = useGameStore.getState();
            if (gameState?.currentPlayerId === playerId) {
                socket.emit('game:endTurn');
            }
        }, [socket]),

        moveRobber: useCallback((hexCoord: { q: number; r: number }, stealFromPlayerId?: string) => {
            socket.emit('game:moveRobber', hexCoord, stealFromPlayerId);
        }, [socket]),

        discardCards: useCallback((resources: Partial<Record<ResourceType, number>>) => {
            socket.emit('game:discardCards', resources);
        }, [socket]),

        proposeTrade: useCallback((toPlayerId: string | null, offering: Record<string, number>, requesting: Record<string, number>) => {
            const { playerId } = useGameStore.getState();
            socket.emit('trade:offer', { fromPlayerId: playerId || '', toPlayerId, offering, requesting });
        }, [socket]),

        acceptTrade: useCallback((tradeId: string) => {
            socket.emit('trade:accept', tradeId);
        }, [socket]),

        rejectTrade: useCallback((tradeId: string) => {
            socket.emit('trade:reject', tradeId);
        }, [socket]),

        // FIXED: Don't send ratio - server calculates it
        bankTrade: useCallback((give: ResourceType, receive: ResourceType) => {
            socket.emit('trade:bank', give, receive, 0); // Ratio ignored by server
        }, [socket])
    };
}

// Hook for room actions
export function useRoomActions() {
    const socket = getSocket();
    const setPlayerInfo = useGameStore(state => state.setPlayerInfo);
    const setGameState = useGameStore(state => state.setGameState);

    const createInitialGameState = (roomId: string, players: Player[]): GameState => ({
        id: roomId,
        board: { hexes: [], vertices: [], edges: [], ports: [] },
        players,
        buildings: [],
        roads: [],
        currentPlayerId: '',
        phase: 'lobby',
        turnPhase: 'roll',
        turnNumber: 0,
        diceRoll: null,
        devCardDeck: [],
        activeTradeOffer: null,
        longestRoadPlayerId: null,
        largestArmyPlayerId: null,
        winnerId: null,
        setupRound: 1
    });

    return {
        createRoom: useCallback((playerName: string, maxPlayers: 4 | 6 = 4): Promise<{ roomId: string; playerId: string }> => {
            return new Promise((resolve, reject) => {
                socket.emit('room:create', playerName, maxPlayers, (response) => {
                    if (response.success && response.roomId && response.playerId) {
                        setPlayerInfo(response.playerId, playerName, response.roomId);
                        setGameState(createInitialGameState(response.roomId, [{
                            id: response.playerId,
                            name: playerName,
                            color: 'red',
                            resources: { brick: 0, lumber: 0, ore: 0, wheat: 0, sheep: 0 },
                            devCards: [],
                            knightsPlayed: 0,
                            longestRoad: 0,
                            victoryPoints: 0,
                            isConnected: true
                        }]));
                        resolve({ roomId: response.roomId, playerId: response.playerId });
                    } else {
                        reject(new Error(response.error || 'Failed to create room'));
                    }
                });
            });
        }, [socket, setPlayerInfo, setGameState]),

        joinRoom: useCallback((roomId: string, playerName: string): Promise<{ playerId: string }> => {
            return new Promise((resolve, reject) => {
                socket.emit('room:join', roomId, playerName, (response) => {
                    if (response.success && response.playerId) {
                        setPlayerInfo(response.playerId, playerName, roomId);
                        if (response.players) {
                            setGameState(createInitialGameState(roomId, response.players));
                        }
                        resolve({ playerId: response.playerId });
                    } else {
                        reject(new Error(response.error || 'Failed to join room'));
                    }
                });
            });
        }, [socket, setPlayerInfo, setGameState]),

        startGame: useCallback(() => {
            socket.emit('room:startGame');
        }, [socket]),

        leaveRoom: useCallback(() => {
            socket.emit('room:leave');
            useGameStore.getState().reset();
        }, [socket])
    };
}
