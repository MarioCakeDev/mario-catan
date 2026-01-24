import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';
import type {
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
} from '@catan/shared';
import { RoomManager } from '../rooms/RoomManager';
import { registerRoomHandlers } from './handlers/roomHandlers';
import { registerGameHandlers } from './handlers/gameHandlers';
import { registerTradeHandlers } from './handlers/tradeHandlers';

export type GameSocket = Parameters<
    Parameters<typeof io.on<'connection'>>[1]
>[0];

let io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export function setupSocketServer(httpServer: HttpServer, corsOrigin: string) {
    io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
        httpServer,
        {
            cors: {
                origin: corsOrigin,
                methods: ['GET', 'POST'],
                credentials: true
            },
            pingInterval: 10000,
            pingTimeout: 5000
        }
    );

    const roomManager = new RoomManager();

    io.on('connection', (socket) => {
        console.log(`🔌 Client connected: ${socket.id}`);

        // Register all event handlers
        registerRoomHandlers(io, socket, roomManager);
        registerGameHandlers(io, socket, roomManager);
        registerTradeHandlers(io, socket, roomManager);

        // Handle disconnection
        socket.on('disconnect', (reason) => {
            console.log(`🔌 Client disconnected: ${socket.id} (${reason})`);

            const { roomId, playerId } = socket.data;
            if (roomId && playerId) {
                const room = roomManager.getRoom(roomId);
                if (room) {
                    room.setPlayerConnected(playerId, false);
                    socket.to(roomId).emit('player:disconnected', playerId);
                }
            }
        });
    });

    return io;
}

export { io };
