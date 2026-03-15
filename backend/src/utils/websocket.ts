import { Server as SocketIOServer, Socket } from 'socket.io';
import { logger } from './logging';

interface UserSocket {
  userId: number;
  socket: Socket;
}

const userSockets = new Map<number, UserSocket>();

export function initializeWebSocket(io: SocketIOServer) {
  io.on('connection', (socket: Socket) => {
    logger.info(`📡 New WebSocket connection: ${socket.id}`);

    // Join user to personal room
    socket.on('subscribe:user', (userId: number) => {
      socket.join(`user:${userId}`);
      userSockets.set(userId, { userId, socket });
      logger.debug(`✓ User ${userId} subscribed to personal updates`);
    });

    // Subscribe to market updates
    socket.on('subscribe:market', () => {
      socket.join('market');
      logger.info(`✓ Client ${socket.id} subscribed to market updates`);
    });

    // Subscribe to arbitrage updates
    socket.on('subscribe:arbitrage', () => {
      socket.join('arbitrage');
      logger.debug(`✓ Client ${socket.id} subscribed to arbitrage updates`);
    });

    // Subscribe to specific skin
    socket.on('subscribe:skin', (skinId: number) => {
      socket.join(`skin:${skinId}`);
      logger.debug(`✓ Client ${socket.id} subscribed to skin ${skinId}`);
    });

    // Unsubscribe
    socket.on('unsubscribe:skin', (skinId: number) => {
      socket.leave(`skin:${skinId}`);
    });

    // Disconnect
    socket.on('disconnect', () => {
      // Find and remove user socket
      for (const [userId, userSocket] of userSockets.entries()) {
        if (userSocket.socket.id === socket.id) {
          userSockets.delete(userId);
          break;
        }
      }
      logger.debug(`❌ Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function broadcastMarketUpdate(data: any) {
  const io = (global as any).io;
  if (io) {
    // Emit on multiple event names for compatibility
    if (data?.type === 'market_summary') {
      io.to('market').emit('market:summary', data);
    } else if (data?.type === 'market_index') {
      io.to('market').emit('market:index', data);
    } else if (data?.type === 'arbitrage_list') {
      io.to('market').emit('arbitrage:list', data);
    } else {
      io.to('market').emit('market:update', data);
      io.to('market').emit('market:price', data);
    }
  }
}

export function broadcastArbitrageOpportunity(data: any) {
  const io = (global as any).io;
  if (io) {
    io.to('arbitrage').emit('arbitrage:update', data);
    io.to('arbitrage').emit('arbitrage:opportunity', data);
  }
}

export function broadcastUserAlert(userId: number, data: any) {
  const io = (global as any).io;
  if (io) {
    io.to(`user:${userId}`).emit('alert:triggered', data);
  }
}

export function broadcastSkinUpdate(skinId: number, data: any) {
  const io = (global as any).io;
  if (io) {
    io.to(`skin:${skinId}`).emit('skin:updated', data);
  }
}

export function getConnectedUsers(): number {
  return userSockets.size;
}

export function getUserSocket(userId: number): Socket | undefined {
  return userSockets.get(userId)?.socket;
}
