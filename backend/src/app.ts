import express, { Express, Request, Response, NextFunction } from 'express';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import passport from 'passport';
import rateLimit from 'express-rate-limit';
import { Server as SocketIOServer } from 'socket.io';
import http from 'http';
import authRoutes from './api/routes/auth';
import skinsRoutes from './api/routes/skins';
import marketRoutes from './api/routes/market';
import portfolioRoutes from './api/routes/portfolio';
import arbitrageRoutes from './api/routes/arbitrage';
import alertsRoutes from './api/routes/alerts';
import watchlistRoutes from './api/routes/watchlist';
import tradesRoutes from './api/routes/trades';
import publicApiRoutes from './api/routes/publicApi';
import billingRoutes from './api/routes/billing';
import storageRoutes from './api/routes/storage';
import sponsoredRoutes from './api/routes/sponsored';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/logging';
import { authMiddleware } from './middleware/auth';
import { initializeWebSocket } from './utils/websocket';
import { publicCache } from './middleware/httpCache';

export function createApp(): Express {
  const app = express();

  // Gzip compression — reduces response sizes by ~70%
  app.use(compression());

  // Security Middleware
  app.use(helmet());
  
  // CORS Configuration
  app.use(cors({
    origin: true, // Allow any origin — requests come through Vite proxy or devtunnels
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
    max: 1000, // generous global limit
    standardHeaders: true,
    legacyHeaders: false,
  });

  const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 120, // 120 requests per minute per IP for API
    standardHeaders: true,
  });

  app.use(limiter);
  app.use('/api/', apiLimiter);

  // Session (required by passport-steam OpenID)
  app.use(session({
    secret: process.env.SESSION_SECRET || 'cs-skin-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 10 * 60 * 1000, // 10 min — only needed during OAuth flow
      secure: false, // set true in production with HTTPS
    },
  }));

  // Passport (required for Steam OAuth)
  app.use(passport.initialize());
  app.use(passport.session());

  // Logging Middleware
  app.use(requestLogger);

  // Health Check
  app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', timestamp: new Date() });
  });

  // Public Routes (no auth required) — cached at edge
  app.use('/api/auth', authRoutes);
  app.use('/api/skins', publicCache(60), skinsRoutes);       // Cache 60s
  app.use('/api/market', publicCache(30), marketRoutes);      // Cache 30s
  app.use('/api/arbitrage', publicCache(30), arbitrageRoutes); // Cache 30s
  app.use('/api/sponsored', publicCache(300), sponsoredRoutes); // Cache 5min

  // Protected Routes (auth required)
  app.use('/api/portfolio', authMiddleware, portfolioRoutes);
  app.use('/api/alerts', authMiddleware, alertsRoutes);
  app.use('/api/watchlist', watchlistRoutes); // Auth handled inside routes
  app.use('/api/trades', tradesRoutes); // Auth handled inside routes
  app.use('/api/public', publicApiRoutes); // Public API with API key auth
  app.use('/api/billing', billingRoutes); // Stripe billing
  app.use('/api/storage', storageRoutes); // Storage container tracker

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
