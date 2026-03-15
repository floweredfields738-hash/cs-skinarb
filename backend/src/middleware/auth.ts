import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logging';

export interface AuthRequest extends Request {
  userId?: number;
  steamId?: string;
  user?: any;
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.userId = (decoded as any).userId;
    req.steamId = (decoded as any).steamId;

    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
}

export async function optionalAuthMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      req.userId = (decoded as any).userId;
      req.steamId = (decoded as any).steamId;
    }

    next();
  } catch (error) {
    // No token or invalid token - continue as guest
    next();
  }
}

export function generateToken(userId: number, steamId: string) {
  return jwt.sign(
    { userId, steamId },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '7d' }
  );
}

export function generateRefreshToken(userId: number) {
  return jwt.sign(
    { userId },
    process.env.REFRESH_TOKEN_SECRET || 'refresh_secret',
    { expiresIn: '30d' }
  );
}
