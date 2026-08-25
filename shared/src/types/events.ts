import type {
    GameState,
    Player,
    Resources,
    TradeOffer,
    HexCoord,
    ResourceType
} from './game.js';

// ============================================
// CLIENT -> SERVER EVENTS
// ============================================

export interface ClientToServerEvents {
    // Room management
    'room:create': (playerName: string, maxPlayers: 4 | 6, callback: (response: RoomResponse) => void) => void;
    'room:join': (roomId: string, playerName: string, callback: (response: JoinResponse) => void) => void;
    'room:leave': () => void;
    'room:startGame': () => void;
    'room:changeColor': (color: string) => void;
    'room:addBot': () => void;
    'room:rejoin': (roomId: string, callback: (response: { success: boolean; players?: any[]; error?: string }) => void) => void;

    // Game actions
    'game:rollDice': () => void;
    'game:buildSettlement': (vertexId: string) => void;
    'game:buildCity': (vertexId: string) => void;
    'game:buildRoad': (edgeId: string) => void;
    'game:buyDevCard': () => void;
    'game:playDevCard': (cardIndex: number, payload?: DevCardPayload) => void;
    'game:endTurn': () => void;

    // Robber
    'game:moveRobber': (hexCoord: HexCoord, stealFromPlayerId?: string) => void;
    'game:discardCards': (resources: Partial<Resources>) => void;

    // Trading
    'trade:offer': (offer: Omit<TradeOffer, 'id' | 'status'>) => void;
    'trade:accept': (tradeId: string) => void;
    'trade:reject': (tradeId: string) => void;
    'trade:cancel': (tradeId: string) => void;
    'trade:bank': (give: ResourceType, receive: ResourceType, ratio: number) => void;

    // Chat
    'chat:message': (message: string) => void;
}

// ============================================
// SERVER -> CLIENT EVENTS
// ============================================

export interface ServerToClientEvents {
    // Room updates
    'room:playerJoined': (player: Player) => void;
    'room:playerLeft': (playerId: string) => void;
    'room:updated': (players: Player[]) => void;

    // Game state
    'game:started': (state: GameState) => void;
    'game:stateUpdate': (state: GameState) => void;
    'game:ended': (winnerId: string) => void;

    // Turn updates
    'turn:diceRolled': (dice: [number, number], playerId: string) => void;
    'turn:changed': (currentPlayerId: string, turnNumber: number) => void;

    // Action feedback
    'action:result': (result: ActionResult) => void;
    'action:error': (error: ActionError) => void;

    // Trading
    'trade:received': (offer: TradeOffer) => void;
    'trade:updated': (offer: TradeOffer) => void;

    // Robber
    'robber:mustDiscard': (playerId: string, amount: number) => void;
    'robber:moved': (hexCoord: HexCoord, movedByPlayerId: string) => void;

    // Chat
    'chat:message': (message: ChatMessage) => void;

    // Connection
    'player:reconnected': (playerId: string) => void;
    'player:disconnected': (playerId: string) => void;
}

// ============================================
// PAYLOAD TYPES
// ============================================

export interface DevCardPayload {
    // For Road Building
    roads?: [string, string];
    // For Year of Plenty
    resources?: [ResourceType, ResourceType];
    // For Monopoly
    resource?: ResourceType;
}

export interface RoomResponse {
    success: boolean;
    roomId?: string;
    playerId?: string;
    maxPlayers?: 4 | 6;
    error?: string;
}

export interface JoinResponse {
    success: boolean;
    playerId?: string;
    players?: Player[];
    maxPlayers?: 4 | 6;
    error?: string;
}

export interface ActionResult {
    success: boolean;
    action: string;
    data?: Record<string, unknown>;
}

export interface ActionError {
    action: string;
    message: string;
    code: string;
}

export interface ChatMessage {
    id: string;
    playerId: string;
    playerName: string;
    message: string;
    timestamp: number;
    isSystem: boolean;
}

// ============================================
// INTER-SERVER EVENTS (for scaling)
// ============================================

export interface InterServerEvents {
    ping: () => void;
}

// ============================================
// SOCKET DATA
// ============================================

export interface SocketData {
    playerId: string;
    playerName: string;
    roomId: string;
}
