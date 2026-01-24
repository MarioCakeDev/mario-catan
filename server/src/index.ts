import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { setupSocketServer } from './socket/socketServer';
import { apiRouter } from './api/routes';

const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

const app = express();
const httpServer = createServer(app);

// Middleware
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

// API routes
app.use('/api', apiRouter);

// Setup Socket.IO
const io = setupSocketServer(httpServer, CORS_ORIGIN);

// Start server
httpServer.listen(PORT, () => {
    console.log(`🎲 Catan server running on port ${PORT}`);
    console.log(`📡 WebSocket ready for connections`);
});

export { app, httpServer, io };
