import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Server as SocketIOServer } from 'socket.io';
import http from 'http';
import authRoutes from './api/routes/auth';
import skinsRoutes from './api/routes/skins';
import marketRoutes from './api/routes/market';
import portfolioRoutes from './api/routes/portfolio';
import arbitrageRoutes from './api/routes/arbitrage';
import alertsRoutes from './api/routes/alerts';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/logging';
import { authMiddleware } from './middleware/auth';
import { initializeWebSocket } from './utils/websocket';

export function createApp(): Express {
  const app = express();

  // Security Middleware
  app.use(helmet());
  
  // CORS Configuration
  app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));

  // Body Parser
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // Rate Limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
  });

  const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // limit each IP to 30 requests per minute for API
    standardHeaders: true,
  });

  app.use(limiter);
  app.use('/api/', apiLimiter);

  // Logging Middleware
  app.use(requestLogger);

  // Health Check
  app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', timestamp: new Date() });
  });

  // Public Routes (no auth required)
  app.use('/api/auth', authRoutes);
  app.use('/api/skins', skinsRoutes); // Public skin metadata
  app.use('/api/market', marketRoutes); // Public market data

  // Semi-public routes (optional auth - some endpoints need auth, reads are public)
  app.use('/api/arbitrage', arbitrageRoutes);

  // Protected Routes (auth required)
  app.use('/api/portfolio', authMiddleware, portfolioRoutes);
  app.use('/api/alerts', authMiddleware, alertsRoutes);

  // 404 Handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({ 
      error: 'Not Found',
      path: req.path,
      method: req.method
    });
  });

  // Error Handler (must be last)
  app.use(errorHandler);

  return app;
}

export function createServer(): http.Server {
  const app = createApp();
  const server = http.createServer(app);

  // Initialize WebSocket
  const io = new SocketIOServer(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST']
    }
  });

  initializeWebSocket(io);

  // Attach io to app for route handlers
  (app as any).io = io;
  (global as any).io = io;

  return server;
}

export default createApp;
