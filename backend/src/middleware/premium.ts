import { Request, Response, NextFunction } from 'express';
import { queryOne } from '../utils/database';

export async function requirePremium(req: Request, res: Response, next: NextFunction) {
  const userId = (req as any).userId;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const user = await queryOne(
    'SELECT premium_tier, premium_expires FROM users WHERE id = $1',
    [userId]
  );

  const isPremium = user?.premium_tier === 'premium' && user?.premium_expires && new Date(user.premium_expires) > new Date();

  if (!isPremium) {
    return res.status(403).json({
      error: 'Premium required',
      upgrade: '/settings',
      message: 'This feature requires a CSkinArb Premium subscription.',
    });
  }

  (req as any).isPremium = true;
  next();
}

export async function checkPremium(req: Request, res: Response, next: NextFunction) {
  const userId = (req as any).userId;
  if (!userId) { (req as any).isPremium = false; return next(); }

  const user = await queryOne(
    'SELECT premium_tier, premium_expires FROM users WHERE id = $1',
    [userId]
  );

  (req as any).isPremium = user?.premium_tier === 'premium' && user?.premium_expires && new Date(user.premium_expires) > new Date();
  next();
}
