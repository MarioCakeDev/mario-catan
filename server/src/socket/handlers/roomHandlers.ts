import type { Server } from 'socket.io';
import type { GameSocket } from '../socketServer';
import type { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from '@catan/shared';
import type { RoomManager } from '../../rooms/RoomManager';
import { createPlayer, getAvailableColor } from '../../game/Resources';

export function registerRoomHandlers(
    io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
    socket: GameSocket,
    roomManager: RoomManager
) {
    // Create a new game room
    socket.on('room:create', (playerName, maxPlayers, callback) => {
        try {
            const { room, player } = roomManager.createRoom(playerName, maxPlayers);

            socket.data.roomId = room.id;
            socket.data.playerId = player.id;
            socket.data.playerName = playerName;

            socket.join(room.id);

            callback({
                success: true,
                roomId: room.id,
                playerId: player.id,
                maxPlayers: room.maxPlayers
            });

            console.log(`🏠 Room ${room.id} created by ${playerName} (${maxPlayers} players max)`);
        } catch (error) {
            callback({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create room'
            });
        }
    });

    // Join an existing room
    socket.on('room:join', (roomId, playerName, callback) => {
        try {
            const room = roomManager.getRoom(roomId);

            if (!room) {
                callback({ success: false, error: 'Room not found' });
                return;
            }

            if (room.isFull()) {
                callback({ success: false, error: 'Room is full' });
                return;
            }

            if (room.gameState.phase !== 'lobby') {
                callback({ success: false, error: 'Game has already started' });
                return;
            }

            const player = room.addPlayer(playerName);

            socket.data.roomId = roomId;
            socket.data.playerId = player.id;
            socket.data.playerName = playerName;

            socket.join(roomId);

            // Notify ALL players in the room (including the new one) with the full updated list
            io.to(roomId).emit('room:updated', room.gameState.players);

            callback({
                success: true,
                playerId: player.id,
                players: room.gameState.players,
                maxPlayers: room.maxPlayers
            });

            console.log(`👤 ${playerName} joined room ${roomId} (${room.gameState.players.length}/${room.maxPlayers} players)`);
        } catch (error) {
            callback({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to join room'
            });
        }
    });

    // Leave room
    socket.on('room:leave', () => {
        const { roomId, playerId } = socket.data;

        if (!roomId || !playerId) return;

        const room = roomManager.getRoom(roomId);
        if (!room) return;

        room.removePlayer(playerId);
        socket.leave(roomId);

        // Notify remaining players with updated list
        io.to(roomId).emit('room:updated', room.gameState.players);

        // Clean up empty rooms
        if (room.isEmpty()) {
            roomManager.deleteRoom(roomId);
            console.log(`🏠 Room ${roomId} deleted (empty)`);
        }

        socket.data.roomId = '';
        socket.data.playerId = '';
    });

    // Start the game
    socket.on('room:startGame', () => {
        const { roomId, playerId } = socket.data;

        if (!roomId || !playerId) {
            socket.emit('action:error', {
                action: 'startGame',
                message: 'Not in a room',
                code: 'NOT_IN_ROOM'
            });
            return;
        }

        const room = roomManager.getRoom(roomId);
        if (!room) return;

        // Only room creator can start
        if (room.gameState.players[0]?.id !== playerId) {
            socket.emit('action:error', {
                action: 'startGame',
                message: 'Only the room creator can start the game',
                code: 'NOT_HOST'
            });
            return;
        }

        // Minimum 2 players
        if (room.gameState.players.length < 2) {
            socket.emit('action:error', {
                action: 'startGame',
                message: 'Need at least 2 players to start',
                code: 'NOT_ENOUGH_PLAYERS'
            });
            return;
        }

        room.startGame();
        io.to(roomId).emit('game:started', room.gameState);

        // Trigger bot if first player is a bot
        if (room.isCurrentPlayerBot()) {
            setTimeout(() => {
                const action = room.getBotAction();
                if (action && action.action === 'buildSettlement') {
                    room.buildSettlement(room.gameState.currentPlayerId, action.params);
                    io.to(roomId).emit('game:stateUpdate', room.gameState);
                }
            }, 500);
        }

        console.log(`🎮 Game started in room ${roomId} with ${room.gameState.players.length} players`);
    });

    // Add a bot player
    socket.on('room:addBot', () => {
        const { roomId, playerId } = socket.data;

        if (!roomId || !playerId) return;

        const room = roomManager.getRoom(roomId);
        if (!room) return;

        // Only host can add bots
        if (room.gameState.players[0]?.id !== playerId) return;

        // Check if room is full
        if (room.gameState.players.length >= room.maxPlayers) return;

        // Check game hasn't started
        if (room.gameState.phase !== 'lobby') return;

        // Create bot with available color
        const color = getAvailableColor(room.gameState.players);
        const botId = `bot-${Date.now()}`;
        const botPlayer = createPlayer(botId, 'Bot', room.gameState.players.length);
        botPlayer.color = color;
        botPlayer.isBot = true;

        room.gameState.players.push(botPlayer);

        // Notify all players
        io.to(roomId).emit('room:updated', room.gameState.players);

        console.log(`🤖 Bot added to room ${roomId} (${room.gameState.players.length}/${room.maxPlayers})`);
    });

    // Change player color
    socket.on('room:changeColor', (color) => {
        const { roomId, playerId } = socket.data;

        if (!roomId || !playerId) return;

        const room = roomManager.getRoom(roomId);
        if (!room) return;

        // Check game hasn't started
        if (room.gameState.phase !== 'lobby') return;

        const player = room.gameState.players.find(p => p.id === playerId);
        if (!player) return;

        // Check color isn't taken by another player
        const colorTaken = room.gameState.players.some(p => p.id !== playerId && p.color === color);
        if (colorTaken) return;

        player.color = color as any;

        // Notify all players
        io.to(roomId).emit('room:updated', room.gameState.players);
    });
}
