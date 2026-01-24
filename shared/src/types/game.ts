// ============================================
// RESOURCE TYPES
// ============================================

export type ResourceType = 'brick' | 'lumber' | 'ore' | 'wheat' | 'sheep';
export type TerrainType = ResourceType | 'desert' | 'water';

export interface Resources {
    brick: number;
    lumber: number;
    ore: number;
    wheat: number;
    sheep: number;
}

// ============================================
// BOARD TYPES
// ============================================

export interface HexCoord {
    q: number;  // Column (axial coordinate)
    r: number;  // Row (axial coordinate)
}

export interface Hex {
    coord: HexCoord;
    terrain: TerrainType;
    number: number | null;  // null for desert
    hasRobber: boolean;
}

export interface Vertex {
    id: string;  // Unique vertex identifier
    hexes: HexCoord[];  // Adjacent hexes (up to 3)
}

export interface Edge {
    id: string;  // Unique edge identifier
    vertices: [string, string];  // Connected vertices
    isCoastal?: boolean;  // For harbor placement
}

export type PortType = ResourceType | 'any';

export interface Port {
    vertexIds: [string, string];  // Two vertices the port connects to
    type: PortType;
    ratio: number;  // 2 for specific resource, 3 for any
}

export interface Board {
    hexes: Hex[];
    vertices: Vertex[];
    edges: Edge[];
    ports: Port[];
}

// ============================================
// BUILDING TYPES
// ============================================

export type BuildingType = 'settlement' | 'city';

export interface Building {
    type: BuildingType;
    vertexId: string;
    playerId: string;
}

export interface Road {
    edgeId: string;
    playerId: string;
}

// ============================================
// DEVELOPMENT CARDS
// ============================================

export type DevCardType =
    | 'knight'
    | 'victoryPoint'
    | 'roadBuilding'
    | 'yearOfPlenty'
    | 'monopoly';

export interface DevCard {
    type: DevCardType;
    playedThisTurn: boolean;
}

// ============================================
// PLAYER TYPES
// ============================================

export type PlayerColor = 'red' | 'blue' | 'orange' | 'white' | 'green' | 'brown';

export interface Player {
    id: string;
    name: string;
    color: PlayerColor;
    resources: Resources;
    devCards: DevCard[];
    knightsPlayed: number;
    longestRoad: number;
    victoryPoints: number;
    isConnected: boolean;
}

// ============================================
// GAME STATE
// ============================================

export type GamePhase =
    | 'lobby'           // Waiting for players
    | 'setup'           // Initial placement (2 settlements, 2 roads)
    | 'playing'         // Main game
    | 'finished';       // Game over

export type TurnPhase =
    | 'roll'            // Must roll dice
    | 'robber'          // Must move robber (after rolling 7)
    | 'main'            // Build, trade, play dev cards
    | 'discard';        // Players must discard (>7 cards on rolling 7)

export interface TradeOffer {
    id: string;
    fromPlayerId: string;
    toPlayerId: string | null;  // null = open to all
    offering: Partial<Resources>;
    requesting: Partial<Resources>;
    status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
}

export interface GameState {
    id: string;
    board: Board;
    players: Player[];
    buildings: Building[];
    roads: Road[];
    currentPlayerId: string;
    phase: GamePhase;
    turnPhase: TurnPhase;
    turnNumber: number;
    diceRoll: [number, number] | null;
    devCardDeck: DevCardType[];
    activeTradeOffer: TradeOffer | null;
    longestRoadPlayerId: string | null;
    largestArmyPlayerId: string | null;
    winnerId: string | null;
    setupRound: number;  // 1 or 2 during setup phase
}

// ============================================
// BUILD COSTS
// ============================================

export const BUILD_COSTS: Record<'road' | 'settlement' | 'city' | 'devCard', Partial<Resources>> = {
    road: { brick: 1, lumber: 1 },
    settlement: { brick: 1, lumber: 1, wheat: 1, sheep: 1 },
    city: { ore: 3, wheat: 2 },
    devCard: { ore: 1, wheat: 1, sheep: 1 }
};

// ============================================
// GAME CONFIGURATION
// ============================================

export interface GameConfig {
    maxPlayers: 4 | 6;
    victoryPointsToWin: number;
    enableTimer: boolean;
    turnTimeLimit: number;  // seconds, 0 = unlimited
    randomizeHarbors: boolean;  // Randomize harbor positions
    enableVoiceChat: boolean;  // Enable voice chat feature
}

export const DEFAULT_CONFIG: GameConfig = {
    maxPlayers: 4,
    victoryPointsToWin: 10,
    enableTimer: false,
    turnTimeLimit: 0,
    randomizeHarbors: false,
    enableVoiceChat: false
};
