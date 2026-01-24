import { Router } from 'express';

export const apiRouter = Router();

// Get list of active rooms
apiRouter.get('/rooms', (_req, res) => {
    // This would query the room manager for public rooms
    // For now, return empty list (rooms are created via WebSocket)
    res.json({ rooms: [] });
});

// Health check for the API
apiRouter.get('/status', (_req, res) => {
    res.json({
        status: 'ok',
        version: '1.0.0',
        uptime: process.uptime()
    });
});
