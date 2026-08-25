import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@catan/shared';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: GameSocket | null = null;

export function getSocket(): GameSocket {
    if (!socket) {
        socket = io(SOCKET_URL, {
            autoConnect: false,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });
    }
    return socket;
}

export function connectSocket(): void {
    const s = getSocket();
    if (!s.connected) {
        s.connect();
    }
}

export function disconnectSocket(): void {
    if (socket?.connected) {
        socket.disconnect();
    }
}
