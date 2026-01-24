import type { Server } from 'socket.io';
import type {
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData,
    ResourceType
} from '@catan/shared';
import type { RoomManager } from '../../rooms/RoomManager';

type GameSocket = Parameters<
    Parameters<Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>['on']>[1]
>[0];

// Valid resource types for validation
const VALID_RESOURCES: ResourceType[] = ['brick', 'lumber', 'ore', 'wheat', 'sheep'];

function isValidResourceType(value: unknown): value is ResourceType {
    return typeof value === 'string' && VALID_RESOURCES.includes(value as ResourceType);
}

export function registerTradeHandlers(
    io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
    socket: GameSocket,
    roomManager: RoomManager
) {
    // Create trade offer
    socket.on('trade:offer', (offer) => {
        const { roomId, playerId } = socket.data;
        if (!roomId || !playerId) return;

        const room = roomManager.getRoom(roomId);
        if (!room) return;

        // Validate it's player's turn and main phase
        if (room.gameState.currentPlayerId !== playerId) {
            socket.emit('action:error', { action: 'trade:offer', message: 'Not your turn', code: 'NOT_YOUR_TURN' });
            return;
        }

        if (room.gameState.turnPhase !== 'main') {
            socket.emit('action:error', { action: 'trade:offer', message: 'Cannot trade during this phase', code: 'WRONG_PHASE' });
            return;
        }

        // Validate offer structure
        if (!offer || !offer.offering || !offer.requesting) {
            socket.emit('action:error', { action: 'trade:offer', message: 'Invalid trade offer', code: 'INVALID_INPUT' });
            return;
        }

        const tradeOffer = room.createTradeOffer(playerId, offer.toPlayerId ?? null, offer.offering, offer.requesting);

        if (!tradeOffer) {
            socket.emit('action:error', { action: 'trade:offer', message: 'Cannot create trade offer', code: 'TRADE_FAILED' });
            return;
        }

        io.to(roomId).emit('trade:received', tradeOffer);
    });

    // Accept trade
    socket.on('trade:accept', (tradeId) => {
        const { roomId, playerId } = socket.data;
        if (!roomId || !playerId) return;

        const room = roomManager.getRoom(roomId);
        if (!room) return;

        if (typeof tradeId !== 'string') {
            socket.emit('action:error', { action: 'trade:accept', message: 'Invalid trade ID', code: 'INVALID_INPUT' });
            return;
        }

        const result = room.acceptTrade(tradeId, playerId);
        if (!result.success) {
            socket.emit('action:error', { action: 'trade:accept', message: result.error!, code: result.code || 'TRADE_FAILED' });
            return;
        }

        io.to(roomId).emit('game:stateUpdate', room.gameState);
        socket.emit('action:result', { success: true, action: 'trade:accept' });
    });

    // Reject trade
    socket.on('trade:reject', (tradeId) => {
        const { roomId, playerId } = socket.data;
        if (!roomId || !playerId) return;

        const room = roomManager.getRoom(roomId);
        if (!room) return;

        room.rejectTrade(tradeId, playerId);
        io.to(roomId).emit('game:stateUpdate', room.gameState);
    });

    // Cancel trade
    socket.on('trade:cancel', (tradeId) => {
        const { roomId, playerId } = socket.data;
        if (!roomId || !playerId) return;

        const room = roomManager.getRoom(roomId);
        if (!room) return;

        room.cancelTrade(tradeId, playerId);
        io.to(roomId).emit('game:stateUpdate', room.gameState);
    });

    // Bank trade - CRITICAL FIX: Server calculates ratio, client only sends resources
    socket.on('trade:bank', (give, receive, _ratio) => {
        const { roomId, playerId } = socket.data;
        if (!roomId || !playerId) return;

        const room = roomManager.getRoom(roomId);
        if (!room) return;

        // Validate resource types
        if (!isValidResourceType(give) || !isValidResourceType(receive)) {
            socket.emit('action:error', { action: 'trade:bank', message: 'Invalid resource type', code: 'INVALID_INPUT' });
            return;
        }

        // Note: _ratio is ignored - server calculates the correct ratio
        const result = room.bankTrade(playerId, give, receive);
        if (!result.success) {
            socket.emit('action:error', { action: 'trade:bank', message: result.error!, code: result.code || 'TRADE_FAILED' });
            return;
        }

        io.to(roomId).emit('game:stateUpdate', room.gameState);
        socket.emit('action:result', { success: true, action: 'trade:bank' });
    });
}
