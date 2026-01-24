import { nanoid } from 'nanoid';
import { GameRoom } from '../game/GameRoom';
import type { Player } from '@catan/shared';

export class RoomManager {
    private rooms: Map<string, GameRoom> = new Map();

    createRoom(creatorName: string, maxPlayers: 4 | 6 = 4): { room: GameRoom; player: Player } {
        const roomId = nanoid(6).toUpperCase();
        const room = new GameRoom(roomId, maxPlayers);
        const player = room.addPlayer(creatorName);

        this.rooms.set(roomId, room);

        return { room, player };
    }

    getRoom(roomId: string): GameRoom | undefined {
        return this.rooms.get(roomId.toUpperCase());
    }

    deleteRoom(roomId: string): void {
        this.rooms.delete(roomId.toUpperCase());
    }

    getRoomCount(): number {
        return this.rooms.size;
    }

    getAllRooms(): GameRoom[] {
        return Array.from(this.rooms.values());
    }
}
