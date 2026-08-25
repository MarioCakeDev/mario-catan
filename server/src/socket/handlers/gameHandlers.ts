import type { Server } from 'socket.io';
import type { GameSocket } from '../socketServer';
import type { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from '@catan/shared';
import type { RoomManager } from '../../rooms/RoomManager';

export function registerGameHandlers(
    io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
    socket: GameSocket,
    roomManager: RoomManager
) {
    // Helper to get room and validate player is in a room
    const getActiveRoom = (action: string) => {
        const { roomId, playerId } = socket.data;
        if (!roomId || !playerId) {
            socket.emit('action:error', { action, message: 'Not in a room', code: 'NOT_IN_ROOM' });
            return null;
        }

        const room = roomManager.getRoom(roomId);
        if (!room) {
            socket.emit('action:error', { action, message: 'Room not found', code: 'ROOM_NOT_FOUND' });
            return null;
        }

        return { room, playerId, roomId };
    };

    // Roll dice
    socket.on('game:rollDice', () => {
        const ctx = getActiveRoom('rollDice');
        if (!ctx) return;
        const { room, playerId, roomId } = ctx;

        // Validate it's player's turn
        if (room.gameState.currentPlayerId !== playerId) {
            socket.emit('action:error', { action: 'rollDice', message: 'Not your turn', code: 'NOT_YOUR_TURN' });
            return;
        }

        if (room.gameState.phase !== 'playing') {
            socket.emit('action:error', { action: 'rollDice', message: 'Cannot roll during this phase', code: 'WRONG_PHASE' });
            return;
        }

        if (room.gameState.turnPhase !== 'roll') {
            socket.emit('action:error', { action: 'rollDice', message: 'Already rolled this turn', code: 'ALREADY_ROLLED' });
            return;
        }

        const result = room.rollDice(playerId);
        if (result.dice) {
            io.to(roomId).emit('turn:diceRolled', result.dice, playerId);
        }
        io.to(roomId).emit('game:stateUpdate', room.gameState);
        io.to(roomId).emit('game:stateUpdate', room.gameState);
    });

    // Build settlement - GameRoom.buildSettlement now handles turn validation
    socket.on('game:buildSettlement', (vertexId) => {
        const ctx = getActiveRoom('buildSettlement');
        if (!ctx) return;
        const { room, playerId, roomId } = ctx;

        // Validate input
        if (typeof vertexId !== 'string' || !vertexId) {
            socket.emit('action:error', { action: 'buildSettlement', message: 'Invalid vertex ID', code: 'INVALID_INPUT' });
            return;
        }

        const result = room.buildSettlement(playerId, vertexId);
        if (!result.success) {
            socket.emit('action:error', { action: 'buildSettlement', message: result.error!, code: result.code || 'BUILD_FAILED' });
            return;
        }

        io.to(roomId).emit('game:stateUpdate', room.gameState);
        socket.emit('action:result', { success: true, action: 'buildSettlement', data: { vertexId } });
    });

    // Build city
    socket.on('game:buildCity', (vertexId) => {
        const ctx = getActiveRoom('buildCity');
        if (!ctx) return;
        const { room, playerId, roomId } = ctx;

        if (typeof vertexId !== 'string' || !vertexId) {
            socket.emit('action:error', { action: 'buildCity', message: 'Invalid vertex ID', code: 'INVALID_INPUT' });
            return;
        }

        const result = room.buildCity(playerId, vertexId);
        if (!result.success) {
            socket.emit('action:error', { action: 'buildCity', message: result.error!, code: result.code || 'BUILD_FAILED' });
            return;
        }

        io.to(roomId).emit('game:stateUpdate', room.gameState);
        socket.emit('action:result', { success: true, action: 'buildCity', data: { vertexId } });
    });

    // Build road
    socket.on('game:buildRoad', (edgeId) => {
        const ctx = getActiveRoom('buildRoad');
        if (!ctx) return;
        const { room, playerId, roomId } = ctx;

        if (typeof edgeId !== 'string' || !edgeId) {
            socket.emit('action:error', { action: 'buildRoad', message: 'Invalid edge ID', code: 'INVALID_INPUT' });
            return;
        }

        const result = room.buildRoad(playerId, edgeId);
        if (!result.success) {
            socket.emit('action:error', { action: 'buildRoad', message: result.error!, code: result.code || 'BUILD_FAILED' });
            return;
        }

        io.to(roomId).emit('game:stateUpdate', room.gameState);
        socket.emit('action:result', { success: true, action: 'buildRoad', data: { edgeId } });
    });

    // Buy development card
    socket.on('game:buyDevCard', () => {
        const ctx = getActiveRoom('buyDevCard');
        if (!ctx) return;
        const { room, playerId, roomId } = ctx;

        const result = room.buyDevCard(playerId);
        if (!result.success) {
            socket.emit('action:error', { action: 'buyDevCard', message: result.error!, code: result.code || 'BUY_FAILED' });
            return;
        }

        io.to(roomId).emit('game:stateUpdate', room.gameState);
        // Only send card type to the player who bought it
        socket.emit('action:result', { success: true, action: 'buyDevCard', data: { cardType: result.cardType } });
    });

    // Play development card
    socket.on('game:playDevCard', (cardIndex, payload) => {
        const ctx = getActiveRoom('playDevCard');
        if (!ctx) return;
        const { room, playerId, roomId } = ctx;

        if (typeof cardIndex !== 'number' || cardIndex < 0) {
            socket.emit('action:error', { action: 'playDevCard', message: 'Invalid card index', code: 'INVALID_INPUT' });
            return;
        }

        const result = room.playDevCard(playerId, cardIndex, payload);
        if (!result.success) {
            socket.emit('action:error', { action: 'playDevCard', message: result.error!, code: result.code || 'PLAY_FAILED' });
            return;
        }

        io.to(roomId).emit('game:stateUpdate', room.gameState);
        socket.emit('action:result', { success: true, action: 'playDevCard' });
    });

    // End turn
    socket.on('game:endTurn', () => {
        const ctx = getActiveRoom('endTurn');
        if (!ctx) return;
        const { room, playerId, roomId } = ctx;

        if (room.gameState.currentPlayerId !== playerId) {
            socket.emit('action:error', { action: 'endTurn', message: 'Not your turn', code: 'NOT_YOUR_TURN' });
            return;
        }

        // Can't end turn during certain phases
        if (room.gameState.turnPhase === 'robber') {
            socket.emit('action:error', { action: 'endTurn', message: 'Must move the robber first', code: 'ROBBER_REQUIRED' });
            return;
        }

        if (room.gameState.turnPhase === 'discard') {
            socket.emit('action:error', { action: 'endTurn', message: 'Players must discard first', code: 'DISCARD_REQUIRED' });
            return;
        }

        if (room.gameState.phase === 'playing' && room.gameState.turnPhase === 'roll') {
            socket.emit('action:error', { action: 'endTurn', message: 'Must roll dice first', code: 'ROLL_REQUIRED' });
            return;
        }

        room.endTurn();
        io.to(roomId).emit('turn:changed', room.gameState.currentPlayerId, room.gameState.turnNumber);
        io.to(roomId).emit('game:stateUpdate', room.gameState);
    });

    // Move robber
    socket.on('game:moveRobber', (hexCoord, stealFromPlayerId) => {
        const ctx = getActiveRoom('moveRobber');
        if (!ctx) return;
        const { room, playerId, roomId } = ctx;

        if (!hexCoord || typeof hexCoord.q !== 'number' || typeof hexCoord.r !== 'number') {
            socket.emit('action:error', { action: 'moveRobber', message: 'Invalid hex coordinates', code: 'INVALID_INPUT' });
            return;
        }

        const result = room.moveRobber(playerId, hexCoord, stealFromPlayerId);
        if (!result.success) {
            socket.emit('action:error', { action: 'moveRobber', message: result.error!, code: result.code || 'ROBBER_FAILED' });
            return;
        }

        io.to(roomId).emit('robber:moved', hexCoord, playerId);
        io.to(roomId).emit('game:stateUpdate', room.gameState);
    });

    // Discard cards (when 7 is rolled)
    socket.on('game:discardCards', (resources) => {
        const ctx = getActiveRoom('discardCards');
        if (!ctx) return;
        const { room, playerId, roomId } = ctx;

        if (!resources || typeof resources !== 'object') {
            socket.emit('action:error', { action: 'discardCards', message: 'Invalid resources', code: 'INVALID_INPUT' });
            return;
        }

        const result = room.discardCards(playerId, resources);
        if (!result.success) {
            socket.emit('action:error', { action: 'discardCards', message: result.error!, code: result.code || 'DISCARD_FAILED' });
            return;
        }

        io.to(roomId).emit('game:stateUpdate', room.gameState);
    });
}
