import express, { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import SteamStrategy from 'passport-steam';
import jwt from 'jsonwebtoken';
import { query } from '../../utils/database';
import { generateToken, generateRefreshToken, authMiddleware } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logging';

const router = express.Router();

// Configure Passport Steam Strategy
passport.use(
  new SteamStrategy(
    {
      returnURL: process.env.STEAM_RETURN_URL || 'http://localhost:5000/api/auth/steam/return',
      apiKey: process.env.STEAM_API_KEY || '',
      realm: process.env.STEAM_REALM || 'http://localhost:5000/',
    },
    async (identifier: string, profile: any, done: Function) => {
      try {
        const steamId = identifier.split('/').pop();
        
        // Check if user exists
        let user = await query(
          'SELECT id FROM users WHERE steam_id = $1',
          [steamId]
        );

        if (!user.rows.length) {
          // Create new user
          const createResult = await query(
            `INSERT INTO users (steam_id, username, avatar_url, created_at, updated_at)
             VALUES ($1, $2, $3, NOW(), NOW())
             RETURNING id, steam_id, username`,
            [steamId, profile.displayName, profile.photos?.[0]?.value || '']
          );
          user = createResult.rows[0];
          logger.info(`New user created: ${steamId}`);
        } else {
          user = user.rows[0];
          // Update last login
          await query('UPDATE users SET updated_at = NOW() WHERE id = $1', [user.id]);
        }

        done(null, { id: user.id, steamId: steamId });
      } catch (error) {
        logger.error('Steam auth error:', error);
        done(error);
      }
    }
  )
);

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const result = await query('SELECT id, steam_id FROM users WHERE id = $1', [id]);
    done(null, result.rows[0]);
  } catch (error) {
    done(error);
  }
});

// Steam OAuth login redirect
router.get(
  '/steam',
  passport.authenticate('steam', { failureRedirect: '/' })
);

// Steam OAuth callback
router.get(
  '/steam/return',
  passport.authenticate('steam', { failureRedirect: '/' }),
  (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const token = generateToken(user.id, user.steamId);
      const refreshToken = generateRefreshToken(user.id);

      // Store refresh token in database
      query(
        `INSERT INTO user_sessions (user_id, refresh_token, expires_at, created_at)
         VALUES ($1, $2, NOW() + INTERVAL '30 days', NOW())`,
        [user.id, refreshToken]
      ).catch(err => logger.error('Failed to store refresh token:', err));

      // Set refresh token as secure HttpOnly cookie
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      // Redirect to frontend with token
      res.redirect(
        `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/success?token=${token}&userId=${user.id}`
      );
    } catch (error) {
      logger.error('Steam return error:', error);
      res.redirect('http://localhost:3000/auth/error?msg=Authentication failed');
    }
  }
);

// Get current user profile
router.get('/me', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;

    const result = await query(
      `SELECT id, steam_id, username, avatar_url, created_at, updated_at
       FROM users WHERE id = $1`,
      [userId]
    );

    if (!result.rows.length) {
      return next(new AppError('User not found', 404, 'USER_NOT_FOUND'));
    }

    res.json({
      success: true,
      user: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// Refresh token
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return next(new AppError('Refresh token required', 401, 'MISSING_REFRESH_TOKEN'));
    }

    // Verify refresh token
    const decoded = jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET || 'refresh-secret-key'
    ) as any;

    // Check if token exists in database
    const result = await query(
      `SELECT user_id FROM user_sessions 
       WHERE user_id = $1 AND refresh_token = $2 AND expires_at > NOW()`,
      [decoded.userId, refreshToken]
    );

    if (!result.rows.length) {
      return next(new AppError('Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN'));
    }

    // Generate new tokens
    const newToken = generateToken(decoded.userId, decoded.steamId);
    const newRefreshToken = generateRefreshToken(decoded.userId);

    // Update refresh token in database
    await query(
      `UPDATE user_sessions SET refresh_token = $1, expires_at = NOW() + INTERVAL '30 days'
       WHERE user_id = $2`,
      [newRefreshToken, decoded.userId]
    );

    res.json({
      success: true,
      token: newToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new AppError('Invalid refresh token', 401, 'INVALID_TOKEN'));
    }
    next(error);
  }
});

// Logout
router.post('/logout', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;

    // Delete all sessions for user
    await query('DELETE FROM user_sessions WHERE user_id = $1', [userId]);

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
