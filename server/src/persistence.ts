import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = process.env.DATA_DIR || '/data';
const ROOMS_FILE = path.join(DATA_DIR, 'rooms.json');

interface SerializedRoom {
    id: string;
    maxPlayers: 4 | 6;
    gameState: any;
    diceDeck: [number, number][];
}

function ensureDataDir(): void {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

export function saveRooms(rooms: SerializedRoom[]): void {
    ensureDataDir();
    const tmp = ROOMS_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(rooms, null, 2));
    fs.renameSync(tmp, ROOMS_FILE);
}

export function loadRooms(): SerializedRoom[] {
    ensureDataDir();
    if (!fs.existsSync(ROOMS_FILE)) return [];
    try {
        const data = fs.readFileSync(ROOMS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}
