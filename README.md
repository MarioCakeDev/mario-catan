# Catan Multiplayer

A self-hosted, real-time multiplayer implementation of the Settlers of Catan board game. This project features a mobile-first design, robust game logic including fair map generation and balanced dice probability, and a modular architecture built with React, Node.js, and TypeScript.

## Features

- **Core Gameplay**: Complete implementation of standard rules including settlements, cities, roads, development cards, resource management, and trading.
- **Fair Map Generation**: Custom algorithm prevents high-probability number tokens (6 and 8) from being placed on adjacent hexes, ensuring a balanced board layout.
- **Balanced Probability**: Implements a "deck-based" dice system that guarantees a standard distribution of rolls over time, reducing statistical anomalies.
- **Real-time Synchronization**: Powered by Socket.IO for instant state updates across all connected clients.
- **Mobile-First Interface**: A responsive UI designed for touch interaction, featuring bottom-sheet controls and optimized assets for mobile devices.
- **Lobby System**: Support for creating and joining rooms with configurable player counts (3-4 players).

## Technology Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **State Management**: Zustand
- **Build Tool**: Vite
- **Styling**: Native CSS with variable-based theming

### Backend
- **Runtime**: Node.js
- **Framework**: Express
- **Communication**: Socket.IO (WebSockets)
- **Language**: TypeScript

### Deployment
- **Containerization**: Docker and Docker Compose
- **Architecture**: Monorepo with shared type definitions

## Getting Started

### Prerequisites
- Node.js (v20 or higher)
- npm (v9 or higher)

### Installation

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Build Shared Types**
   ```bash
   npm run build -w shared
   ```

3. **Start Development Environment**
   This command starts both the client and server in watch mode:
   ```bash
   npm run dev
   ```

   - Client: http://localhost:5173
   - Server: http://localhost:3001

### Deployment

The project includes a Docker configuration for easy deployment.

1. **Build and Start Services**
   ```bash
   docker-compose up -d --build
   ```

2. **Stop Services**
   ```bash
   docker-compose down
   ```

## Project Structure

```
catan/
├── client/                 # React frontend application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Route-level page components
│   │   ├── store/          # Global state management
│   │   ├── hooks/          # Custom React hooks
│   │   └── socket/         # Socket definitions
├── server/                 # Node.js backend application
│   ├── src/
│   │   ├── game/           # Core game logic engines
│   │   ├── rooms/          # Lobby and room management
│   │   └── socket/         # Event handlers
├── shared/                 # Common TypeScript interfaces
└── docker-compose.yml      # Container orchestration
```

## Game Rules

1. **Setup**: The game begins with a setup phase where players place two settlements and two roads in a snake order.
2. **Turn Structure**:
   - Roll Dice: Determines resource production.
   - Trade: Exchange resources with other players or the bank.
   - Build: Construct roads, settlements, or cities using resources.
3. **Winning Condition**: The first player to reach 10 Victory Points is declared the winner.

## License

This project is open source and available for use under the MIT License.
