import { nanoid } from 'nanoid';
import { GameRoom } from '../game/GameRoom';
import type { Player } from '@catan/shared';
import { saveRooms, loadRooms } from '../persistence';

export class RoomManager {
    private rooms: Map<string, GameRoom> = new Map();
    private saveTimer: ReturnType<typeof setInterval> | null = null;

    constructor() {
        // Load persisted rooms on startup
        const saved = loadRooms();
        for (const data of saved) {
            const room = new GameRoom(data.id, data.maxPlayers, {
                gameState: data.gameState,
                diceDeck: data.diceDeck
            });
            this.rooms.set(data.id, room);
            console.log(`📦 Restored room ${data.id} (${room.gameState.players.length} players, phase: ${room.gameState.phase})`);
        }

        // Auto-save every 30 seconds and on dirty rooms
        this.saveTimer = setInterval(() => this.save(), 30_000);
    }

    createRoom(creatorName: string, maxPlayers: 4 | 6 = 4): { room: GameRoom; player: Player } {
        const roomId = nanoid(6).toUpperCase();
        const room = new GameRoom(roomId, maxPlayers);
        const player = room.addPlayer(creatorName);

        this.rooms.set(roomId, room);
        this.save();

        return { room, player };
    }

    getRoom(roomId: string): GameRoom | undefined {
        return this.rooms.get(roomId.toUpperCase());
    }

    deleteRoom(roomId: string): void {
        this.rooms.delete(roomId.toUpperCase());
        this.save();
    }

    getRoomCount(): number {
        return this.rooms.size;
    }

    getAllRooms(): GameRoom[] {
        return Array.from(this.rooms.values());
    }

    save(): void {
        const rooms = Array.from(this.rooms.values()).map(r => r.serialize());
        saveRooms(rooms);
    }

    destroy(): void {
        if (this.saveTimer) {
            clearInterval(this.saveTimer);
            this.saveTimer = null;
        }
        this.save();
    }
}
