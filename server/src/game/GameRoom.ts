import type {
    GameState,
    Player,
    Building,
    Road,
    HexCoord,
    Resources,
    TradeOffer,
    DevCardPayload,
    ResourceType,
    DevCardType
} from '@catan/shared';
import { BUILD_COSTS } from '@catan/shared';
import { nanoid } from 'nanoid';
import { randomInt } from 'crypto';
import {
    generateBoard,
    getHexesForRoll,
    getVerticesForHex,
    getEdgesForVertex,
    areVerticesAdjacent,
    getPlayerPortRatio
} from './Board';
import {
    createPlayer,
    createEmptyResources,
    createDevCardDeck,
    createDevCard,
    addResources,
    subtractResources,
    hasResources,
    getTotalResources,
    getRandomResource,
    calculateVictoryPoints
} from './Resources';

// ============================================
// CONSTANTS (Extracted magic numbers)
// ============================================
const DISCARD_THRESHOLD = 7;
const VICTORY_POINTS_TO_WIN = 10;
const MINIMUM_LONGEST_ROAD = 5;
const MINIMUM_KNIGHTS_FOR_ARMY = 3;
const MAX_PLAYER_NAME_LENGTH = 20;

interface ActionResult {
    success: boolean;
    error?: string;
    code?: string;
    cardType?: DevCardType;
}

// Track setup progress per player
interface SetupProgress {
    settlementsPlaced: number;
    roadsPlaced: number;
}

export class GameRoom {
    public readonly id: string;
    public readonly maxPlayers: 4 | 6;
    public gameState: GameState;
    private playerTokens: Map<string, string> = new Map();
    private devCardsPurchasedThisTurn: Set<number> = new Set(); // Track cards bought this turn
    private diceDeck: [number, number][] = []; // 36-card deck for balanced rolls
    private dirty = false;

    constructor(id: string, maxPlayers: 4 | 6 = 4, restoredState?: { gameState: any; diceDeck: [number, number][] }) {
        this.id = id;
        this.maxPlayers = maxPlayers;
        if (restoredState) {
            this.gameState = restoredState.gameState;
            this.diceDeck = restoredState.diceDeck;
        } else {
            this.gameState = this.createInitialState();
            this.initializeDiceDeck();
        }
    }

    serialize(): { id: string; maxPlayers: 4 | 6; gameState: any; diceDeck: [number, number][] } {
        return {
            id: this.id,
            maxPlayers: this.maxPlayers,
            gameState: this.gameState,
            diceDeck: this.diceDeck
        };
    }

    markDirty(): void {
        this.dirty = true;
    }

    isDirty(): boolean {
        return this.dirty;
    }

    clearDirty(): void {
        this.dirty = false;
    }

    private initializeDiceDeck(): void {
        const deck: [number, number][] = [];
        // Generate 36 standard combinations (1-6, 1-6)
        for (let d1 = 1; d1 <= 6; d1++) {
            for (let d2 = 1; d2 <= 6; d2++) {
                deck.push([d1, d2]);
            }
        }

        // Fisher-Yates shuffle using crypto.randomInt for security
        for (let i = deck.length - 1; i > 0; i--) {
            const j = randomInt(i + 1);
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }

        this.diceDeck = deck;
        console.log(`Initialized balanced dice deck with ${this.diceDeck.length} rolls.`);
    }

    private createInitialState(): GameState {
        return {
            id: this.id,
            board: { hexes: [], vertices: [], edges: [], ports: [] },
            players: [],
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
        };
    }

    // ============================================
    // UTILITY: Input Sanitization
    // ============================================
    private sanitizeName(name: string): string {
        return name
            .trim()
            .slice(0, MAX_PLAYER_NAME_LENGTH)
            .replace(/[<>&"']/g, '')
            .replace(/[\x00-\x1F\x7F]/g, '');
    }

    // ============================================
    // ROOM MANAGEMENT
    // ============================================

    addPlayer(name: string): Player {
        const sanitizedName = this.sanitizeName(name);
        const player = createPlayer(nanoid(8), sanitizedName || 'Player', this.gameState.players.length);
        const token = nanoid(16);
        this.playerTokens.set(player.id, token);
        this.gameState.players.push(player);
        return player;
    }

    removePlayer(playerId: string): void {
        const wasHost = this.gameState.players[0]?.id === playerId;
        this.gameState.players = this.gameState.players.filter(p => p.id !== playerId);
        this.playerTokens.delete(playerId);

        if (wasHost && this.gameState.players.length > 0) {
            console.log(`Host transferred to ${this.gameState.players[0].name}`);
        }
    }

    transferHost(newHostId: string): boolean {
        const newHostIndex = this.gameState.players.findIndex(p => p.id === newHostId);
        if (newHostIndex === -1) return false;

        const [newHost] = this.gameState.players.splice(newHostIndex, 1);
        this.gameState.players.unshift(newHost);
        return true;
    }

    getHostId(): string | null {
        return this.gameState.players[0]?.id || null;
    }

    setPlayerConnected(playerId: string, connected: boolean): void {
        const player = this.getPlayer(playerId);
        if (player) {
            player.isConnected = connected;
        }
    }

    getPlayer(playerId: string): Player | undefined {
        return this.gameState.players.find(p => p.id === playerId);
    }

    isFull(): boolean {
        return this.gameState.players.length >= this.maxPlayers;
    }

    isEmpty(): boolean {
        return this.gameState.players.length === 0;
    }

    // ============================================
    // GAME LIFECYCLE
    // ============================================

    startGame(): void {
        this.gameState.board = generateBoard();
        this.gameState.devCardDeck = createDevCardDeck();
        this.initializeDiceDeck(); // Reset deck on new game
        this.gameState.phase = 'setup';
        this.gameState.turnPhase = 'main';
        this.gameState.turnNumber = 1;
        this.gameState.currentPlayerId = this.gameState.players[0].id;
        this.gameState.setupRound = 1;
    }

    // ============================================
    // TURN VALIDATION
    // ============================================

    validateTurn(playerId: string, requireMainPhase: boolean = true): ActionResult | null {
        if (this.gameState.currentPlayerId !== playerId) {
            return { success: false, error: 'Not your turn', code: 'NOT_YOUR_TURN' };
        }

        if (this.gameState.phase === 'finished') {
            return { success: false, error: 'Game is over', code: 'GAME_OVER' };
        }

        if (requireMainPhase && this.gameState.phase === 'playing' && this.gameState.turnPhase !== 'main') {
            return { success: false, error: 'Cannot perform this action in current phase', code: 'WRONG_PHASE' };
        }

        return null;
    }

    // ============================================
    // DICE ROLLING (Cryptographically secure)
    // ============================================

    rollDice(playerId: string): ActionResult & { dice?: [number, number] } {
        // Validate turn
        if (this.gameState.currentPlayerId !== playerId) {
            return { success: false, error: 'Not your turn', code: 'NOT_YOUR_TURN' };
        }

        if (this.gameState.turnPhase !== 'roll') {
            return { success: false, error: 'Cannot roll dice in this phase', code: 'WRONG_PHASE' };
        }

        // Draw from deck
        if (this.diceDeck.length === 0) {
            this.initializeDiceDeck();
        }

        const roll = this.diceDeck.pop();
        if (!roll) {
            // Fallback (should not happen due to check above)
            return { success: false, error: 'Dice deck error', code: 'INTERNAL_ERROR' };
        }

        // Store result
        this.gameState.diceRoll = roll;
        const total = roll[0] + roll[1];

        if (total === DISCARD_THRESHOLD) {
            this.gameState.turnPhase = 'robber';

            // Check if players need to discard (more than 7 cards)
            this.gameState.players.forEach(p => {
                if (getTotalResources(p.resources) > 7) {
                    // Logic to enforce discard would be handled client-side prompting
                }
            });
        } else {
            this.distributeResources(total);
            this.gameState.turnPhase = 'main';
        }

        return { success: true, dice: roll };
    }

    private distributeResources(roll: number): void {
        const producingHexes = getHexesForRoll(this.gameState.board, roll);

        for (const hex of producingHexes) {
            if (hex.terrain === 'desert' || hex.terrain === 'water') continue;
            const resource = hex.terrain as ResourceType;

            const vertices = getVerticesForHex(this.gameState.board, hex.coord);

            for (const vertex of vertices) {
                const building = this.gameState.buildings.find(b => b.vertexId === vertex.id);
                if (building) {
                    const player = this.getPlayer(building.playerId);
                    if (player) {
                        const amount = building.type === 'city' ? 2 : 1;
                        player.resources[resource] += amount;
                    }
                }
            }
        }
    }

    // ============================================
    // SETUP PHASE HELPERS
    // ============================================

    private getSetupProgress(playerId: string): SetupProgress {
        const settlementsPlaced = this.gameState.buildings.filter(
            b => b.playerId === playerId && b.type === 'settlement'
        ).length;
        const roadsPlaced = this.gameState.roads.filter(
            r => r.playerId === playerId
        ).length;
        return { settlementsPlaced, roadsPlaced };
    }

    private giveInitialResources(playerId: string, vertexId: string): void {
        // Only give resources for second settlement (during setup round 2)
        if (this.gameState.setupRound !== 2) return;

        const player = this.getPlayer(playerId);
        if (!player) return;

        const vertex = this.gameState.board.vertices.find(v => v.id === vertexId);
        if (!vertex) return;

        // Give one resource for each adjacent hex (except desert)
        for (const hexCoord of vertex.hexes) {
            const hex = this.gameState.board.hexes.find(
                h => h.coord.q === hexCoord.q && h.coord.r === hexCoord.r
            );
            if (hex && hex.terrain !== 'desert') {
                player.resources[hex.terrain as ResourceType]++;
            }
        }
    }

    // ============================================
    // BUILDING
    // ============================================

    buildSettlement(playerId: string, vertexId: string): ActionResult {
        const player = this.getPlayer(playerId);
        if (!player) return { success: false, error: 'Player not found', code: 'PLAYER_NOT_FOUND' };

        // Turn validation
        const turnError = this.validateTurn(playerId, this.gameState.phase !== 'setup');
        if (turnError) return turnError;

        // Validate vertex exists
        const vertex = this.gameState.board.vertices.find(v => v.id === vertexId);
        if (!vertex) return { success: false, error: 'Invalid vertex', code: 'INVALID_VERTEX' };

        // Check if vertex is occupied
        if (this.gameState.buildings.some(b => b.vertexId === vertexId)) {
            return { success: false, error: 'Vertex already occupied', code: 'OCCUPIED' };
        }

        // Check distance rule (no adjacent settlements)
        for (const building of this.gameState.buildings) {
            if (areVerticesAdjacent(this.gameState.board, vertexId, building.vertexId)) {
                return { success: false, error: 'Too close to another settlement', code: 'DISTANCE_RULE' };
            }
        }

        // Setup phase logic
        if (this.gameState.phase === 'setup') {
            const progress = this.getSetupProgress(playerId);
            const expectedSettlements = this.gameState.setupRound;

            if (progress.settlementsPlaced >= expectedSettlements) {
                return { success: false, error: 'Already placed settlement this round', code: 'SETUP_LIMIT' };
            }

            // Must place settlement before road
            if (progress.settlementsPlaced !== progress.roadsPlaced) {
                return { success: false, error: 'Place a road first', code: 'SETUP_ORDER' };
            }

            // Place settlement
            this.gameState.buildings.push({ type: 'settlement', vertexId, playerId });

            // Give initial resources for second settlement
            this.giveInitialResources(playerId, vertexId);
        } else {
            // Main game phase
            if (!hasResources(player.resources, BUILD_COSTS.settlement)) {
                return { success: false, error: 'Not enough resources', code: 'NO_RESOURCES' };
            }

            // Must be connected to own road
            const connectedEdges = getEdgesForVertex(this.gameState.board, vertexId);
            const hasRoadConnection = connectedEdges.some(edge =>
                this.gameState.roads.some(r => r.edgeId === edge.id && r.playerId === playerId)
            );

            if (!hasRoadConnection) {
                return { success: false, error: 'Must connect to your road', code: 'NO_ROAD_CONNECTION' };
            }

            subtractResources(player.resources, BUILD_COSTS.settlement);
            this.gameState.buildings.push({ type: 'settlement', vertexId, playerId });
        }

        this.updateVictoryPoints();
        this.checkWinCondition();
        this.maybeAdvanceSetup();

        return { success: true };
    }

    buildCity(playerId: string, vertexId: string): ActionResult {
        const player = this.getPlayer(playerId);
        if (!player) return { success: false, error: 'Player not found', code: 'PLAYER_NOT_FOUND' };

        // Turn validation
        const turnError = this.validateTurn(playerId);
        if (turnError) return turnError;

        // Cannot upgrade during setup
        if (this.gameState.phase === 'setup') {
            return { success: false, error: 'Cannot upgrade to city during setup', code: 'WRONG_PHASE' };
        }

        // Find existing settlement
        const buildingIndex = this.gameState.buildings.findIndex(
            b => b.vertexId === vertexId && b.playerId === playerId && b.type === 'settlement'
        );

        if (buildingIndex === -1) {
            return { success: false, error: 'No settlement to upgrade', code: 'NO_SETTLEMENT' };
        }

        if (!hasResources(player.resources, BUILD_COSTS.city)) {
            return { success: false, error: 'Not enough resources', code: 'NO_RESOURCES' };
        }

        subtractResources(player.resources, BUILD_COSTS.city);
        this.gameState.buildings[buildingIndex].type = 'city';

        this.updateVictoryPoints();
        this.checkWinCondition();

        return { success: true };
    }

    buildRoad(playerId: string, edgeId: string): ActionResult {
        const player = this.getPlayer(playerId);
        if (!player) return { success: false, error: 'Player not found', code: 'PLAYER_NOT_FOUND' };

        // Turn validation (less strict during setup)
        const turnError = this.validateTurn(playerId, this.gameState.phase !== 'setup');
        if (turnError) return turnError;

        // Validate edge exists
        const edge = this.gameState.board.edges.find(e => e.id === edgeId);
        if (!edge) return { success: false, error: 'Invalid edge', code: 'INVALID_EDGE' };

        // Check if already built
        if (this.gameState.roads.some(r => r.edgeId === edgeId)) {
            return { success: false, error: 'Road already exists', code: 'OCCUPIED' };
        }

        // Check connection to player's buildings or roads
        const [v1, v2] = edge.vertices;
        const hasConnection =
            this.gameState.buildings.some(b =>
                (b.vertexId === v1 || b.vertexId === v2) && b.playerId === playerId
            ) ||
            this.gameState.roads.some(r => {
                const roadEdge = this.gameState.board.edges.find(e => e.id === r.edgeId);
                return roadEdge && r.playerId === playerId &&
                    (roadEdge.vertices.includes(v1) || roadEdge.vertices.includes(v2));
            });

        // Setup phase logic
        if (this.gameState.phase === 'setup') {
            const progress = this.getSetupProgress(playerId);

            // Must have placed settlement first
            if (progress.settlementsPlaced <= progress.roadsPlaced) {
                return { success: false, error: 'Place a settlement first', code: 'SETUP_ORDER' };
            }

            // Road must connect to the settlement just placed
            const lastSettlement = this.gameState.buildings
                .filter(b => b.playerId === playerId && b.type === 'settlement')
                .pop();

            if (!lastSettlement || (v1 !== lastSettlement.vertexId && v2 !== lastSettlement.vertexId)) {
                return { success: false, error: 'Road must connect to your settlement', code: 'NO_CONNECTION' };
            }

            this.gameState.roads.push({ edgeId, playerId });
        } else {
            // Main game phase
            if (!hasConnection) {
                return { success: false, error: 'Must connect to your building or road', code: 'NO_CONNECTION' };
            }

            if (!hasResources(player.resources, BUILD_COSTS.road)) {
                return { success: false, error: 'Not enough resources', code: 'NO_RESOURCES' };
            }

            subtractResources(player.resources, BUILD_COSTS.road);
            this.gameState.roads.push({ edgeId, playerId });
        }

        this.updateLongestRoad();
        this.updateVictoryPoints();
        this.maybeAdvanceSetup();

        return { success: true };
    }

    // ============================================
    // DEVELOPMENT CARDS
    // ============================================

    buyDevCard(playerId: string): ActionResult {
        const player = this.getPlayer(playerId);
        if (!player) return { success: false, error: 'Player not found', code: 'PLAYER_NOT_FOUND' };

        // Turn validation
        const turnError = this.validateTurn(playerId);
        if (turnError) return turnError;

        if (!hasResources(player.resources, BUILD_COSTS.devCard)) {
            return { success: false, error: 'Not enough resources', code: 'NO_RESOURCES' };
        }

        if (this.gameState.devCardDeck.length === 0) {
            return { success: false, error: 'No development cards left', code: 'DECK_EMPTY' };
        }

        subtractResources(player.resources, BUILD_COSTS.devCard);
        const cardType = this.gameState.devCardDeck.pop()!;
        const newCard = createDevCard(cardType);
        newCard.playedThisTurn = true; // Mark as purchased this turn (can't be played)
        player.devCards.push(newCard);

        // Track the index of cards purchased this turn
        this.devCardsPurchasedThisTurn.add(player.devCards.length - 1);

        this.updateVictoryPoints();
        this.checkWinCondition();

        return { success: true, cardType };
    }

    playDevCard(playerId: string, cardIndex: number, payload?: DevCardPayload): ActionResult {
        const player = this.getPlayer(playerId);
        if (!player) return { success: false, error: 'Player not found', code: 'PLAYER_NOT_FOUND' };

        // Turn validation (can play before rolling)
        if (this.gameState.currentPlayerId !== playerId) {
            return { success: false, error: 'Not your turn', code: 'NOT_YOUR_TURN' };
        }

        if (cardIndex < 0 || cardIndex >= player.devCards.length) {
            return { success: false, error: 'Invalid card index', code: 'INVALID_CARD' };
        }

        const card = player.devCards[cardIndex];

        if (card.type === 'victoryPoint') {
            return { success: false, error: 'Victory point cards are revealed at game end', code: 'VP_CARD' };
        }

        // CRITICAL FIX: Cannot play card purchased this turn
        if (card.playedThisTurn) {
            return { success: false, error: 'Cannot play a development card the same turn it was purchased', code: 'SAME_TURN' };
        }

        // Remove the card
        player.devCards.splice(cardIndex, 1);

        switch (card.type) {
            case 'knight':
                player.knightsPlayed++;
                this.gameState.turnPhase = 'robber';
                this.updateLargestArmy();
                break;

            case 'roadBuilding':
                // Player can build 2 roads for free
                if (payload?.roads && payload.roads.length <= 2) {
                    for (const edgeId of payload.roads) {
                        // Build without resource cost check
                        const edge = this.gameState.board.edges.find(e => e.id === edgeId);
                        if (edge && !this.gameState.roads.some(r => r.edgeId === edgeId)) {
                            this.gameState.roads.push({ edgeId, playerId });
                        }
                    }
                    this.updateLongestRoad();
                }
                break;

            case 'yearOfPlenty':
                // Take 2 resources of choice from bank
                if (payload?.resources && payload.resources.length <= 2) {
                    for (const resource of payload.resources) {
                        player.resources[resource]++;
                    }
                }
                break;

            case 'monopoly':
                // Steal all of one resource from other players
                if (payload?.resource) {
                    const resourceType = payload.resource;
                    for (const other of this.gameState.players) {
                        if (other.id !== playerId) {
                            const amount = other.resources[resourceType];
                            other.resources[resourceType] = 0;
                            player.resources[resourceType] += amount;
                        }
                    }
                }
                break;
        }

        this.updateVictoryPoints();
        this.checkWinCondition();

        return { success: true };
    }

    // ============================================
    // ROBBER
    // ============================================

    moveRobber(playerId: string, hexCoord: HexCoord, stealFromPlayerId?: string): ActionResult {
        // Turn validation
        if (this.gameState.currentPlayerId !== playerId) {
            return { success: false, error: 'Not your turn', code: 'NOT_YOUR_TURN' };
        }

        if (this.gameState.turnPhase !== 'robber') {
            return { success: false, error: 'Not in robber phase', code: 'WRONG_PHASE' };
        }

        const targetHex = this.gameState.board.hexes.find(
            h => h.coord.q === hexCoord.q && h.coord.r === hexCoord.r
        );

        if (!targetHex) {
            return { success: false, error: 'Invalid hex', code: 'INVALID_HEX' };
        }

        // CRITICAL FIX: Robber must move to a different hex
        if (targetHex.hasRobber) {
            return { success: false, error: 'Robber must move to a different hex', code: 'SAME_HEX' };
        }

        // Remove robber from old position
        for (const hex of this.gameState.board.hexes) {
            hex.hasRobber = false;
        }

        // Place robber on new hex
        targetHex.hasRobber = true;

        // Steal from a player if specified
        if (stealFromPlayerId) {
            // Validate the victim has a building on this hex
            const vertices = getVerticesForHex(this.gameState.board, hexCoord);
            const victimHasBuilding = this.gameState.buildings.some(
                b => b.playerId === stealFromPlayerId && vertices.some(v => v.id === b.vertexId)
            );

            if (!victimHasBuilding) {
                return { success: false, error: 'Cannot steal from player without building on this hex', code: 'INVALID_VICTIM' };
            }

            const victim = this.getPlayer(stealFromPlayerId);
            const thief = this.getPlayer(playerId);

            if (victim && thief && victim.id !== thief.id) {
                const stolenResource = getRandomResource(victim.resources);
                if (stolenResource) {
                    victim.resources[stolenResource]--;
                    thief.resources[stolenResource]++;
                }
            }
        }

        this.gameState.turnPhase = 'main';
        return { success: true };
    }

    discardCards(playerId: string, resources: Partial<Resources>): ActionResult {
        const player = this.getPlayer(playerId);
        if (!player) return { success: false, error: 'Player not found', code: 'PLAYER_NOT_FOUND' };

        const totalCards = getTotalResources(player.resources);

        // Only require discard if player has more than threshold
        if (totalCards <= DISCARD_THRESHOLD) {
            return { success: false, error: 'You don\'t need to discard', code: 'NO_DISCARD_NEEDED' };
        }

        const discardAmount = Math.floor(totalCards / 2);
        const discarding = Object.values(resources).reduce((sum, val) => sum + (val || 0), 0);

        if (discarding !== discardAmount) {
            return { success: false, error: `Must discard exactly ${discardAmount} cards`, code: 'WRONG_AMOUNT' };
        }

        if (!subtractResources(player.resources, resources)) {
            return { success: false, error: 'Cannot discard cards you don\'t have', code: 'INVALID_DISCARD' };
        }

        // Check if all players have discarded
        const stillMustDiscard = this.gameState.players.filter(
            p => getTotalResources(p.resources) > DISCARD_THRESHOLD
        );

        if (stillMustDiscard.length === 0) {
            this.gameState.turnPhase = 'robber';
        }

        return { success: true };
    }

    // ============================================
    // TRADING
    // ============================================

    createTradeOffer(
        fromPlayerId: string,
        toPlayerId: string | null,
        offering: Partial<Resources>,
        requesting: Partial<Resources>
    ): TradeOffer | null {
        const player = this.getPlayer(fromPlayerId);
        if (!player) return null;

        // Validate player has resources to offer
        if (!hasResources(player.resources, offering)) {
            return null;
        }

        const offer: TradeOffer = {
            id: nanoid(8),
            fromPlayerId,
            toPlayerId,
            offering,
            requesting,
            status: 'pending'
        };

        this.gameState.activeTradeOffer = offer;
        return offer;
    }

    acceptTrade(tradeId: string, acceptingPlayerId: string): ActionResult {
        const offer = this.gameState.activeTradeOffer;

        // CRITICAL FIX: Check status to prevent race condition
        if (!offer || offer.id !== tradeId || offer.status !== 'pending') {
            return { success: false, error: 'Trade offer not available', code: 'TRADE_NOT_FOUND' };
        }

        if (offer.toPlayerId && offer.toPlayerId !== acceptingPlayerId) {
            return { success: false, error: 'This offer is not for you', code: 'WRONG_PLAYER' };
        }

        // Lock the trade immediately
        offer.status = 'accepted';

        const offerer = this.getPlayer(offer.fromPlayerId);
        const accepter = this.getPlayer(acceptingPlayerId);

        if (!offerer || !accepter) {
            this.gameState.activeTradeOffer = null;
            return { success: false, error: 'Player not found', code: 'PLAYER_NOT_FOUND' };
        }

        // Validate both players have the resources
        if (!hasResources(offerer.resources, offer.offering)) {
            this.gameState.activeTradeOffer = null;
            return { success: false, error: 'Offerer doesn\'t have the resources', code: 'NO_RESOURCES' };
        }
        if (!hasResources(accepter.resources, offer.requesting)) {
            this.gameState.activeTradeOffer = null;
            return { success: false, error: 'You don\'t have the requested resources', code: 'NO_RESOURCES' };
        }

        // Execute trade
        subtractResources(offerer.resources, offer.offering);
        addResources(offerer.resources, offer.requesting);
        subtractResources(accepter.resources, offer.requesting);
        addResources(accepter.resources, offer.offering);

        this.gameState.activeTradeOffer = null;

        return { success: true };
    }

    rejectTrade(tradeId: string, _rejectingPlayerId: string): void {
        if (this.gameState.activeTradeOffer?.id === tradeId) {
            this.gameState.activeTradeOffer.status = 'rejected';
            this.gameState.activeTradeOffer = null;
        }
    }

    cancelTrade(tradeId: string, cancellingPlayerId: string): void {
        const offer = this.gameState.activeTradeOffer;
        if (offer?.id === tradeId && offer.fromPlayerId === cancellingPlayerId) {
            offer.status = 'cancelled';
            this.gameState.activeTradeOffer = null;
        }
    }

    // CRITICAL FIX: Server calculates trade ratio, not client
    bankTrade(playerId: string, give: ResourceType, receive: ResourceType): ActionResult {
        const player = this.getPlayer(playerId);
        if (!player) return { success: false, error: 'Player not found', code: 'PLAYER_NOT_FOUND' };

        // Turn validation
        const turnError = this.validateTurn(playerId);
        if (turnError) return turnError;

        // Server calculates the correct ratio based on player's ports
        const ratio = getPlayerPortRatio(
            this.gameState.board,
            this.gameState.buildings,
            playerId,
            give
        );

        if (player.resources[give] < ratio) {
            return { success: false, error: `Need ${ratio} ${give} to trade`, code: 'NO_RESOURCES' };
        }

        if (give === receive) {
            return { success: false, error: 'Cannot trade same resource', code: 'SAME_RESOURCE' };
        }

        player.resources[give] -= ratio;
        player.resources[receive]++;

        return { success: true };
    }

    // ============================================
    // TURN MANAGEMENT
    // ============================================

    endTurn(): void {
        const currentIndex = this.gameState.players.findIndex(
            p => p.id === this.gameState.currentPlayerId
        );

        // Clear dev cards purchased this turn tracking
        this.devCardsPurchasedThisTurn.clear();

        // Reset dev card flags for current player
        const currentPlayer = this.gameState.players[currentIndex];
        if (currentPlayer) {
            for (const card of currentPlayer.devCards) {
                card.playedThisTurn = false;
            }
        }

        // Handle setup phase
        if (this.gameState.phase === 'setup') {
            this.advanceSetupTurn(currentIndex);
            return;
        }

        // Normal turn progression
        const nextIndex = (currentIndex + 1) % this.gameState.players.length;
        this.gameState.currentPlayerId = this.gameState.players[nextIndex].id;
        this.gameState.turnNumber++;
        this.gameState.turnPhase = 'roll';
        this.gameState.diceRoll = null;
        this.gameState.activeTradeOffer = null;
    }

    private advanceSetupTurn(currentIndex: number): void {
        const playerCount = this.gameState.players.length;
        const progress = this.getSetupProgress(this.gameState.currentPlayerId);

        // Validate setup is complete for this turn
        const expectedPlacements = this.gameState.setupRound;
        if (progress.settlementsPlaced < expectedPlacements || progress.roadsPlaced < expectedPlacements) {
            // Don't advance - player hasn't finished
            return;
        }

        if (this.gameState.setupRound === 1) {
            // First round: forward order
            if (currentIndex < playerCount - 1) {
                this.gameState.currentPlayerId = this.gameState.players[currentIndex + 1].id;
            } else {
                // Start second round (same player goes again)
                this.gameState.setupRound = 2;
            }
        } else {
            // Second round: reverse order
            if (currentIndex > 0) {
                this.gameState.currentPlayerId = this.gameState.players[currentIndex - 1].id;
            } else {
                // Setup complete, start main game
                this.gameState.phase = 'playing';
                this.gameState.turnPhase = 'roll';
                this.gameState.currentPlayerId = this.gameState.players[0].id;
            }
        }
    }

    // ============================================
    // VICTORY CONDITIONS
    // ============================================

    private updateVictoryPoints(): void {
        for (const player of this.gameState.players) {
            const settlements = this.gameState.buildings.filter(
                b => b.playerId === player.id && b.type === 'settlement'
            ).length;

            const cities = this.gameState.buildings.filter(
                b => b.playerId === player.id && b.type === 'city'
            ).length;

            player.victoryPoints = calculateVictoryPoints(
                player,
                settlements,
                cities,
                this.gameState.longestRoadPlayerId === player.id,
                this.gameState.largestArmyPlayerId === player.id
            );
        }
    }

    // CRITICAL FIX: Proper longest road calculation using DFS
    private updateLongestRoad(): void {
        let longestLength = MINIMUM_LONGEST_ROAD - 1; // Must be at least 5 to claim
        let currentHolder = this.gameState.longestRoadPlayerId;
        let newHolder: string | null = null;

        for (const player of this.gameState.players) {
            const roadLength = this.calculateLongestRoad(player.id);
            player.longestRoad = roadLength;

            if (roadLength > longestLength) {
                longestLength = roadLength;
                newHolder = player.id;
            } else if (roadLength === longestLength && player.id === currentHolder) {
                // Current holder keeps it on tie
                newHolder = currentHolder;
            }
        }

        this.gameState.longestRoadPlayerId = newHolder;
    }

    // CRITICAL FIX: Proper DFS algorithm for longest continuous road
    private calculateLongestRoad(playerId: string): number {
        const playerRoads = this.gameState.roads.filter(r => r.playerId === playerId);
        if (playerRoads.length === 0) return 0;

        // Build adjacency graph: vertex -> list of connected vertices via this player's roads
        const graph = new Map<string, string[]>();
        const edgeKeys = new Set<string>();

        for (const road of playerRoads) {
            const edge = this.gameState.board.edges.find(e => e.id === road.edgeId);
            if (!edge) continue;

            const [v1, v2] = edge.vertices;

            if (!graph.has(v1)) graph.set(v1, []);
            if (!graph.has(v2)) graph.set(v2, []);
            graph.get(v1)!.push(v2);
            graph.get(v2)!.push(v1);

            // Store edge key for visited tracking
            const edgeKey = [v1, v2].sort().join('-');
            edgeKeys.add(edgeKey);
        }

        // Check for opponent buildings that break the road
        const breakingBuildings = new Set<string>();
        for (const building of this.gameState.buildings) {
            if (building.playerId !== playerId) {
                breakingBuildings.add(building.vertexId);
            }
        }

        let maxLength = 0;

        // DFS from each vertex
        const dfs = (vertex: string, visited: Set<string>, length: number): void => {
            maxLength = Math.max(maxLength, length);

            for (const neighbor of graph.get(vertex) || []) {
                const edgeKey = [vertex, neighbor].sort().join('-');

                // Skip if we've already used this edge in the path
                if (visited.has(edgeKey)) continue;

                // Skip if an opponent's building breaks the path at the neighbor
                // (unless it's the first step from a breaking building)
                if (length > 0 && breakingBuildings.has(neighbor)) continue;

                visited.add(edgeKey);
                dfs(neighbor, visited, length + 1);
                visited.delete(edgeKey);
            }
        };

        for (const vertex of graph.keys()) {
            // Start DFS from vertices that have player buildings or are endpoints
            dfs(vertex, new Set(), 0);
        }

        return maxLength;
    }

    // CRITICAL FIX: Proper tie-breaking for largest army
    private updateLargestArmy(): void {
        let largestCount = MINIMUM_KNIGHTS_FOR_ARMY - 1; // Must have at least 3 knights
        let currentHolder = this.gameState.largestArmyPlayerId;
        let newHolder: string | null = null;

        for (const player of this.gameState.players) {
            if (player.knightsPlayed > largestCount) {
                largestCount = player.knightsPlayed;
                newHolder = player.id;
            } else if (player.knightsPlayed === largestCount && player.id === currentHolder) {
                // Current holder keeps it on tie
                newHolder = currentHolder;
            }
        }

        this.gameState.largestArmyPlayerId = newHolder;
    }

    private checkWinCondition(): void {
        for (const player of this.gameState.players) {
            if (player.victoryPoints >= VICTORY_POINTS_TO_WIN) {
                this.gameState.winnerId = player.id;
                this.gameState.phase = 'finished';
                break;
            }
        }
    }

    // ============================================
    // BOT LOGIC
    // ============================================

    isCurrentPlayerBot(): boolean {
        const player = this.gameState.players.find(p => p.id === this.gameState.currentPlayerId);
        return player?.isBot === true;
    }

    getBotAction(): { action: string; params?: any } | null {
        if (!this.isCurrentPlayerBot()) return null;

        const player = this.gameState.players.find(p => p.id === this.gameState.currentPlayerId);
        if (!player) return null;

        if (this.gameState.phase === 'setup') {
            const progress = this.getSetupProgress(player.id);
            const expected = this.gameState.setupRound;

            // Step 1: place settlement (respecting distance rule)
            if (progress.settlementsPlaced < expected) {
                const available = this.gameState.board.vertices.filter(v =>
                    !this.gameState.buildings.some(b => b.vertexId === v.id) &&
                    !this.gameState.buildings.some(b => areVerticesAdjacent(this.gameState.board, v.id, b.vertexId))
                );
                if (available.length === 0) return null;
                const vertex = available[Math.floor(Math.random() * available.length)];
                return { action: 'buildSettlement', params: vertex.id };
            }

            // Step 2: place road adjacent to last settlement
            if (progress.roadsPlaced < progress.settlementsPlaced) {
                const mySettlements = this.gameState.buildings.filter(
                    b => b.playerId === player.id && b.type === 'settlement'
                );
                const lastSettlement = mySettlements[mySettlements.length - 1];
                if (!lastSettlement) return null;

                const candidateEdges = this.gameState.board.edges.filter(e =>
                    (e.vertices[0] === lastSettlement.vertexId || e.vertices[1] === lastSettlement.vertexId) &&
                    !this.gameState.roads.some(r => r.edgeId === e.id)
                );
                if (candidateEdges.length === 0) return null;
                const edge = candidateEdges[Math.floor(Math.random() * candidateEdges.length)];
                return { action: 'buildRoad', params: edge.id };
            }

            return null;
        }

        if (this.gameState.turnPhase === 'roll') {
            return { action: 'rollDice' };
        }

        if (this.gameState.turnPhase === 'main') {
            return { action: 'endTurn' };
        }

        return null;
    }

    // Auto-advance setup turn when the current player finished their placements
    private maybeAdvanceSetup(): void {
        if (this.gameState.phase !== 'setup') return;
        const progress = this.getSetupProgress(this.gameState.currentPlayerId);
        const expected = this.gameState.setupRound;
        if (progress.settlementsPlaced >= expected && progress.roadsPlaced >= expected) {
            const currentIndex = this.gameState.players.findIndex(
                p => p.id === this.gameState.currentPlayerId
            );
            this.advanceSetupTurn(currentIndex);
        }
    }
}
