import type { Resources, ResourceType, Player, PlayerColor, DevCard, DevCardType } from './types/game.js';

// ============================================
// RESOURCE HELPERS
// ============================================

export function createEmptyResources(): Resources {
    return {
        brick: 0,
        lumber: 0,
        ore: 0,
        wheat: 0,
        sheep: 0
    };
}

export function addResources(target: Resources, toAdd: Partial<Resources>): void {
    for (const [resource, amount] of Object.entries(toAdd)) {
        if (amount && resource in target) {
            target[resource as ResourceType] += amount;
        }
    }
}

export function subtractResources(target: Resources, toSubtract: Partial<Resources>): boolean {
    // First check if we have enough
    for (const [resource, amount] of Object.entries(toSubtract)) {
        if (amount && target[resource as ResourceType] < amount) {
            return false;
        }
    }

    // Then subtract
    for (const [resource, amount] of Object.entries(toSubtract)) {
        if (amount) {
            target[resource as ResourceType] -= amount;
        }
    }

    return true;
}

export function hasResources(resources: Resources, required: Partial<Resources>): boolean {
    for (const [resource, amount] of Object.entries(required)) {
        if (amount && resources[resource as ResourceType] < amount) {
            return false;
        }
    }
    return true;
}

export function getTotalResources(resources: Resources): number {
    return Object.values(resources).reduce((sum, val) => sum + val, 0);
}

export function getRandomResource(resources: Resources): ResourceType | null {
    const available: ResourceType[] = [];
    for (const [resource, amount] of Object.entries(resources)) {
        for (let i = 0; i < amount; i++) {
            available.push(resource as ResourceType);
        }
    }

    if (available.length === 0) return null;
    return available[Math.floor(Math.random() * available.length)];
}

// ============================================
// PLAYER HELPERS
// ============================================

const PLAYER_COLORS: PlayerColor[] = ['red', 'blue', 'orange', 'white', 'green', 'brown'];

export function createPlayer(id: string, name: string, colorIndex: number): Player {
    return {
        id,
        name,
        color: PLAYER_COLORS[colorIndex % PLAYER_COLORS.length],
        resources: createEmptyResources(),
        devCards: [],
        knightsPlayed: 0,
        longestRoad: 0,
        victoryPoints: 0,
        isConnected: true
    };
}

export function getAvailableColor(players: Player[]): PlayerColor {
    const usedColors = new Set(players.map(p => p.color));
    return PLAYER_COLORS.find(c => !usedColors.has(c)) || PLAYER_COLORS[0];
}

// ============================================
// DEV CARD HELPERS
// ============================================

const DEV_CARD_DISTRIBUTION: Record<DevCardType, number> = {
    knight: 14,
    victoryPoint: 5,
    roadBuilding: 2,
    yearOfPlenty: 2,
    monopoly: 2
};

export function createDevCardDeck(): DevCardType[] {
    const deck: DevCardType[] = [];

    for (const [type, count] of Object.entries(DEV_CARD_DISTRIBUTION)) {
        for (let i = 0; i < count; i++) {
            deck.push(type as DevCardType);
        }
    }

    // Shuffle
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    return deck;
}

export function createDevCard(type: DevCardType): DevCard {
    return {
        type,
        playedThisTurn: false
    };
}

// ============================================
// VICTORY POINT CALCULATION
// ============================================

export function calculateVictoryPoints(
    player: Player,
    settlementCount: number,
    cityCount: number,
    hasLongestRoad: boolean,
    hasLargestArmy: boolean
): number {
    let points = 0;

    // Settlements = 1 VP each
    points += settlementCount;

    // Cities = 2 VP each
    points += cityCount * 2;

    // Longest Road = 2 VP
    if (hasLongestRoad) points += 2;

    // Largest Army = 2 VP
    if (hasLargestArmy) points += 2;

    // Victory Point dev cards
    points += player.devCards.filter(c => c.type === 'victoryPoint').length;

    return points;
}

// ============================================
// DICE ROLLING - True random (no pity)
// ============================================

export function rollDice(): [number, number] {
    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    return [die1, die2];
}
