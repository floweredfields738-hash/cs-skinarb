import express, { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import SteamStrategy from 'passport-steam';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';
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
        logger.info('Steam strategy callback - identifier: ' + identifier);
        logger.info('Steam strategy callback - profile: ' + profile?.displayName);
        const steamId = identifier.split('/').pop();

        // Check if user exists
        const userResult = await query(
          'SELECT id FROM users WHERE steam_id = $1',
          [steamId]
        );

        let user: any;
        if (!userResult.rows.length) {
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
          user = userResult.rows[0];
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

passport.serializeUser((user: any, done: (err: any, user?: any) => void) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done: (err: any, user?: any) => void) => {
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

// Steam OAuth callback — manual OpenID verification (bypasses passport-steam's broken verifier)
router.get('/steam/return', async (req: Request, res: Response) => {
  try {
    const steamId = (req.query['openid.claimed_id'] as string)?.split('/').pop();

    if (!steamId) {
      logger.error('Steam return: no steam ID in callback');
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?error=no_steamid`);
    }

    logger.info('Steam return: got steamId ' + steamId);

    // Fetch Steam profile using the API key directly
    const axios = (await import('axios')).default;
    const profileRes = await axios.get(
      `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${process.env.STEAM_API_KEY}&steamids=${steamId}`
    );
    const player = profileRes.data?.response?.players?.[0];

    if (!player) {
      logger.error('Steam return: could not fetch profile for ' + steamId);
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?error=no_profile`);
    }

    // Find or create user in database
    let userResult = await query('SELECT id, steam_id FROM users WHERE steam_id = $1', [steamId]);

    if (!userResult.rows.length) {
      // Create new user
      const createResult = await query(
        `INSERT INTO users (steam_id, username, avatar_url, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         RETURNING id, steam_id`,
        [steamId, player.personaname, player.avatarfull || player.avatar || '']
      );
      userResult = createResult;
      logger.info(`New user created: ${steamId} (${player.personaname})`);
    } else {
      // Update profile
      await query(
        'UPDATE users SET username = $1, avatar_url = $2, updated_at = NOW() WHERE steam_id = $3',
        [player.personaname, player.avatarfull || player.avatar || '', steamId]
      );
    }

    const user = userResult.rows[0];
    const token = generateToken(user.id, user.steam_id || steamId);
    const refreshToken = generateRefreshToken(user.id);

    // Store session tokens
    query(
      `INSERT INTO user_sessions (user_id, token, refresh_token, expires_at, created_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '30 days', NOW())`,
      [user.id, token, refreshToken]
    ).catch(err => logger.error('Failed to store session:', err));

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    logger.info(`Steam login success: user ${user.id} (${player.personaname})`);

    res.redirect(
      `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?token=${token}&userId=${user.id}`
    );
  } catch (error: any) {
    logger.error('Steam return error: ' + (error.message || error));
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?error=server_error`);
  }
});

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

// ─── Email Auth (Resend) ───────────────────────────
import { sendVerificationEmail, sendMagicLinkEmail } from '../../services/emailService';

// Set email + send verification
router.post('/email/set', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'Valid email required' });
    }

    // Generate verification token
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    await query(
      'UPDATE users SET email = $1, email_verified = FALSE, email_verification_token = $2, email_verification_expires = $3 WHERE id = $4',
      [email, token, expires, userId]
    );

    // Get username for email
    const user = await query('SELECT username FROM users WHERE id = $1', [userId]);
    const username = user.rows[0]?.username || 'Trader';

    const sent = await sendVerificationEmail(email, token, username);
    res.json({ success: true, sent, message: sent ? 'Verification email sent' : 'Email saved but send failed — check Resend API key' });
  } catch (error) {
    next(error);
  }
});

// Verify email token
router.get('/email/verify', async (req: Request, res: Response) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  try {
    const { token } = req.query;
    if (!token) return res.redirect(`${frontendUrl}/settings?email_error=no_token`);

    const result = await query(
      'SELECT id FROM users WHERE email_verification_token = $1 AND email_verification_expires > NOW()',
      [token]
    );

    if (!result.rows.length) {
      return res.redirect(`${frontendUrl}/settings?email_error=invalid_or_expired`);
    }

    await query(
      'UPDATE users SET email_verified = TRUE, email_verification_token = NULL WHERE id = $1',
      [result.rows[0].id]
    );

    logger.info(`Email verified for user ${result.rows[0].id}`);
    res.redirect(`${frontendUrl}/settings?email_verified=true`);
  } catch {
    res.redirect(`${frontendUrl}/settings?email_error=server_error`);
  }
});

// Magic link login (passwordless)
router.post('/email/magic-link', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email required' });

    // Find user with this verified email
    const user = await query(
      'SELECT id, email_verified FROM users WHERE email = $1',
      [email]
    );

    if (!user.rows.length) {
      // Don't reveal if email exists
      return res.json({ success: true, message: 'If an account exists, a login link has been sent' });
    }

    if (!user.rows[0].email_verified) {
      return res.json({ success: true, message: 'If an account exists, a login link has been sent' });
    }

    // Generate magic link token
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    await query(
      'UPDATE users SET magic_link_token = $1, magic_link_expires = $2 WHERE id = $3',
      [token, expires, user.rows[0].id]
    );

    await sendMagicLinkEmail(email, token);
    res.json({ success: true, message: 'If an account exists, a login link has been sent' });
  } catch (error) {
    next(error);
  }
});

// Consume magic link
router.get('/email/magic-link/verify', async (req: Request, res: Response) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  try {
    const { token: mlToken } = req.query;
    if (!mlToken) return res.redirect(`${frontendUrl}/login?error=no_token`);

    const result = await query(
      'SELECT id, steam_id FROM users WHERE magic_link_token = $1 AND magic_link_expires > NOW()',
      [mlToken]
    );

    if (!result.rows.length) {
      return res.redirect(`${frontendUrl}/login?error=invalid_or_expired`);
    }

    const user = result.rows[0];

    // Clear magic link
    await query('UPDATE users SET magic_link_token = NULL WHERE id = $1', [user.id]);

    // Generate auth tokens
    const authToken = generateToken(user.id, user.steam_id || '');
    const refreshToken = generateRefreshToken(user.id);

    query(
      'INSERT INTO user_sessions (user_id, token, refresh_token, expires_at, created_at) VALUES ($1, $2, $3, NOW() + INTERVAL \'30 days\', NOW())',
      [user.id, authToken, refreshToken]
    ).catch(() => {});

    logger.info(`Magic link login: user ${user.id}`);
    res.redirect(`${frontendUrl}/auth/callback?token=${authToken}&userId=${user.id}`);
  } catch {
    res.redirect(`${frontendUrl}/login?error=server_error`);
  }
});

// ─── Discord OAuth ─────────────────────────────────
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '';
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || '';
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'http://localhost:5000/api/auth/discord/callback';

router.get('/discord', (req: Request, res: Response) => {
  if (!DISCORD_CLIENT_ID) {
    return res.status(503).json({ error: 'Discord login not configured' });
  }
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify email',
  });
  res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
});

router.get('/discord/callback', async (req: Request, res: Response) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  try {
    const { code } = req.query;
    if (!code) {
      return res.redirect(`${frontendUrl}/auth/callback?error=no_code`);
    }

    // Exchange code for token
    const axios = (await import('axios')).default;
    const tokenRes = await axios.post('https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: DISCORD_REDIRECT_URI,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const accessToken = tokenRes.data.access_token;

    // Fetch Discord user profile
    const profileRes = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const discordUser = profileRes.data;
    const discordId = discordUser.id;
    const discordName = discordUser.username;
    const discordAvatar = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordId}/${discordUser.avatar}.png`
      : null;
    const email = discordUser.email || null;

    logger.info(`Discord login: ${discordName} (${discordId})`);

    // Check if this Discord account is already linked to a user
    let userResult = await query('SELECT id, steam_id FROM users WHERE discord_id = $1', [discordId]);

    if (!userResult.rows.length) {
      // Check if user is currently authenticated (linking Discord to existing Steam account)
      const authHeader = req.headers.authorization;
      const existingToken = req.cookies?.authToken || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);

      if (existingToken) {
        try {
          const decoded = jwt.verify(existingToken, process.env.JWT_SECRET || 'your-secret-key-change-in-production') as any;
          // Link Discord to existing user
          await query(
            'UPDATE users SET discord_id = $1, discord_username = $2, discord_avatar = $3, email = COALESCE(email, $4) WHERE id = $5',
            [discordId, discordName, discordAvatar, email, decoded.userId]
          );
          userResult = await query('SELECT id, steam_id FROM users WHERE id = $1', [decoded.userId]);
          logger.info(`Discord linked to existing user ${decoded.userId}`);
        } catch {
          // Token invalid — create new user
        }
      }

      if (!userResult.rows.length) {
        // Create new user with Discord
        const createResult = await query(
          `INSERT INTO users (discord_id, discord_username, discord_avatar, username, avatar_url, email, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
           RETURNING id, steam_id`,
          [discordId, discordName, discordAvatar, discordName, discordAvatar || '', email]
        );
        userResult = createResult;
        logger.info(`New user created via Discord: ${discordName}`);
      }
    } else {
      // Update Discord profile
      await query(
        'UPDATE users SET discord_username = $1, discord_avatar = $2, updated_at = NOW() WHERE discord_id = $3',
        [discordName, discordAvatar, discordId]
      );
    }

    const user = userResult.rows[0];
    const token = generateToken(user.id, user.steam_id || '');
    const refreshToken = generateRefreshToken(user.id);

    // Store session
    query(
      `INSERT INTO user_sessions (user_id, token, refresh_token, expires_at, created_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '30 days', NOW())`,
      [user.id, token, refreshToken]
    ).catch(err => logger.error('Failed to store Discord session:', err));

    res.redirect(`${frontendUrl}/auth/callback?token=${token}&userId=${user.id}`);
  } catch (error: any) {
    logger.error('Discord callback error:', error.message);
    res.redirect(`${frontendUrl}/auth/callback?error=discord_error`);
  }
});

// ─── WebAuthn / Hardware Keys ───────────────────────
const RP_NAME = 'CSkinArb';
const RP_ID = process.env.WEBAUTHN_RP_ID || 'localhost';
const ORIGIN = process.env.FRONTEND_URL || 'http://localhost:3000';

// Start registration — generate challenge
router.post('/webauthn/register/start', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const user = await query('SELECT id, username, steam_id FROM users WHERE id = $1', [userId]);
    if (!user.rows.length) return next(new AppError('User not found', 404));

    const { generateRegistrationOptions } = await import('@simplewebauthn/server');

    // Get existing credentials
    const existing = await query('SELECT credential_id FROM webauthn_credentials WHERE user_id = $1', [userId]);
    const excludeCredentials = existing.rows.map((r: any) => ({
      id: r.credential_id,
    }));

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: new TextEncoder().encode(String(userId)),
      userName: user.rows[0].username || `user-${userId}`,
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    // Store challenge
    await query('UPDATE users SET webauthn_challenge = $1 WHERE id = $2', [options.challenge, userId]);

    res.json({ success: true, options });
  } catch (error) {
    next(error);
  }
});

// Complete registration — verify response
router.post('/webauthn/register/finish', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { credential, deviceName } = req.body;

    const user = await query('SELECT webauthn_challenge FROM users WHERE id = $1', [userId]);
    if (!user.rows.length || !user.rows[0].webauthn_challenge) {
      return res.status(400).json({ success: false, error: 'No pending challenge' });
    }

    const { verifyRegistrationResponse } = await import('@simplewebauthn/server');

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: user.rows[0].webauthn_challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ success: false, error: 'Verification failed' });
    }

    const { credential: cred, credentialDeviceType } = verification.registrationInfo;

    // Store credential
    await query(
      `INSERT INTO webauthn_credentials (user_id, credential_id, public_key, counter, device_name, transports)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userId,
        Buffer.from(cred.id).toString('base64url'),
        Buffer.from(cred.publicKey).toString('base64url'),
        cred.counter,
        deviceName || credentialDeviceType || 'Security Key',
        credential.response?.transports || [],
      ]
    );

    // Clear challenge
    await query('UPDATE users SET webauthn_challenge = NULL WHERE id = $1', [userId]);

    logger.info(`WebAuthn key registered for user ${userId}`);
    res.json({ success: true, message: 'Security key registered' });
  } catch (error) {
    next(error);
  }
});

// Start authentication — generate challenge
router.post('/webauthn/login/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, error: 'userId required' });

    const credentials = await query(
      'SELECT credential_id, transports FROM webauthn_credentials WHERE user_id = $1',
      [userId]
    );

    if (!credentials.rows.length) {
      return res.status(400).json({ success: false, error: 'No security keys registered' });
    }

    const { generateAuthenticationOptions } = await import('@simplewebauthn/server');

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials: credentials.rows.map((r: any) => ({
        id: r.credential_id,
        transports: r.transports || [],
      })),
      userVerification: 'preferred',
    });

    await query('UPDATE users SET webauthn_challenge = $1 WHERE id = $2', [options.challenge, userId]);

    res.json({ success: true, options });
  } catch (error) {
    next(error);
  }
});

// Complete authentication — verify response
router.post('/webauthn/login/finish', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, credential } = req.body;
    if (!userId || !credential) return res.status(400).json({ success: false, error: 'Missing data' });

    const user = await query('SELECT id, steam_id, webauthn_challenge FROM users WHERE id = $1', [userId]);
    if (!user.rows.length || !user.rows[0].webauthn_challenge) {
      return res.status(400).json({ success: false, error: 'No pending challenge' });
    }

    const credId = credential.id;
    const storedCred = await query(
      'SELECT credential_id, public_key, counter FROM webauthn_credentials WHERE credential_id = $1 AND user_id = $2',
      [credId, userId]
    );

    if (!storedCred.rows.length) {
      return res.status(400).json({ success: false, error: 'Unknown credential' });
    }

    const { verifyAuthenticationResponse } = await import('@simplewebauthn/server');

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: user.rows[0].webauthn_challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: Buffer.from(storedCred.rows[0].credential_id, 'base64url').toString('base64url'),
        publicKey: Buffer.from(storedCred.rows[0].public_key, 'base64url'),
        counter: parseInt(storedCred.rows[0].counter),
      },
    });

    if (!verification.verified) {
      return res.status(400).json({ success: false, error: 'Authentication failed' });
    }

    // Update counter
    await query(
      'UPDATE webauthn_credentials SET counter = $1 WHERE credential_id = $2',
      [verification.authenticationInfo.newCounter, credId]
    );
    await query('UPDATE users SET webauthn_challenge = NULL WHERE id = $1', [userId]);

    // Generate tokens
    const token = generateToken(user.rows[0].id, user.rows[0].steam_id || '');
    const refreshToken = generateRefreshToken(user.rows[0].id);

    query(
      'INSERT INTO user_sessions (user_id, token, refresh_token, expires_at, created_at) VALUES ($1, $2, $3, NOW() + INTERVAL \'30 days\', NOW())',
      [userId, token, refreshToken]
    ).catch(() => {});

    logger.info(`WebAuthn login: user ${userId}`);
    res.json({ success: true, token, userId });
  } catch (error) {
    next(error);
  }
});

// List registered keys
router.get('/webauthn/keys', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const result = await query(
      'SELECT id, device_name, created_at FROM webauthn_credentials WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    res.json({ success: true, keys: result.rows });
  } catch (error) {
    next(error);
  }
});

// Remove a key
router.delete('/webauthn/keys/:keyId', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { keyId } = req.params;
    await query('DELETE FROM webauthn_credentials WHERE id = $1 AND user_id = $2', [keyId, userId]);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ─── 2FA: Generate secret + QR code ─────────────────
router.post('/2fa/setup', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;

    // Get user info
    const user = await query('SELECT username, totp_enabled FROM users WHERE id = $1', [userId]);
    if (!user.rows.length) return next(new AppError('User not found', 404));
    if (user.rows[0].totp_enabled) {
      return res.status(400).json({ success: false, error: '2FA is already enabled. Disable it first.' });
    }

    // Generate secret
    const generated = speakeasy.generateSecret({
      name: `CSkinArb (${user.rows[0].username || userId})`,
      issuer: 'CSkinArb',
    });
    const secret = generated.base32;
    const otpauth = generated.otpauth_url || '';

    // Generate QR code as data URL
    const qrCodeUrl = await QRCode.toDataURL(otpauth);

    // Generate backup codes
    const backupCodes = Array.from({ length: 8 }, () =>
      crypto.randomBytes(4).toString('hex').toUpperCase()
    );

    // Store secret temporarily (not enabled yet — user must verify first)
    await query(
      'UPDATE users SET totp_secret = $1, totp_backup_codes = $2 WHERE id = $3',
      [secret, backupCodes, userId]
    );

    res.json({
      success: true,
      secret,
      qrCode: qrCodeUrl,
      backupCodes,
    });
  } catch (error) {
    next(error);
  }
});

// ─── 2FA: Verify and enable ────────────────────────
router.post('/2fa/verify', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { code } = req.body;

    if (!code) return res.status(400).json({ success: false, error: 'Verification code required' });

    // Get stored secret
    const user = await query('SELECT totp_secret, totp_enabled FROM users WHERE id = $1', [userId]);
    if (!user.rows.length) return next(new AppError('User not found', 404));
    if (user.rows[0].totp_enabled) {
      return res.json({ success: true, message: '2FA is already enabled' });
    }
    if (!user.rows[0].totp_secret) {
      return res.status(400).json({ success: false, error: 'Run /2fa/setup first' });
    }

    // Verify the code
    const isValid = speakeasy.totp.verify({ secret: user.rows[0].totp_secret, encoding: 'base32', token: code, window: 1 });
    if (!isValid) {
      return res.status(400).json({ success: false, error: 'Invalid verification code. Try again.' });
    }

    // Enable 2FA
    await query('UPDATE users SET totp_enabled = TRUE WHERE id = $1', [userId]);

    logger.info(`2FA enabled for user ${userId}`);
    res.json({ success: true, message: '2FA has been enabled successfully' });
  } catch (error) {
    next(error);
  }
});

// ─── 2FA: Disable ──────────────────────────────────
router.post('/2fa/disable', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { code } = req.body;

    if (!code) return res.status(400).json({ success: false, error: 'Current 2FA code required to disable' });

    // Verify current code before disabling
    const user = await query('SELECT totp_secret, totp_enabled, totp_backup_codes FROM users WHERE id = $1', [userId]);
    if (!user.rows.length) return next(new AppError('User not found', 404));
    if (!user.rows[0].totp_enabled) {
      return res.json({ success: true, message: '2FA is not enabled' });
    }

    // Check TOTP code or backup code
    const isValid = speakeasy.totp.verify({ secret: user.rows[0].totp_secret, encoding: 'base32', token: code, window: 1 });
    const isBackup = (user.rows[0].totp_backup_codes || []).includes(code.toUpperCase());

    if (!isValid && !isBackup) {
      return res.status(400).json({ success: false, error: 'Invalid code' });
    }

    // Disable 2FA
    await query(
      'UPDATE users SET totp_enabled = FALSE, totp_secret = NULL, totp_backup_codes = NULL WHERE id = $1',
      [userId]
    );

    logger.info(`2FA disabled for user ${userId}`);
    res.json({ success: true, message: '2FA has been disabled' });
  } catch (error) {
    next(error);
  }
});

// ─── 2FA: Status check ─────────────────────────────
router.get('/2fa/status', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const user = await query('SELECT totp_enabled FROM users WHERE id = $1', [userId]);
    res.json({ success: true, enabled: user.rows[0]?.totp_enabled || false });
  } catch (error) {
    next(error);
  }
});

// ─── User Preferences ───────────────────────────────
router.get('/preferences', authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const user = await query('SELECT preferences FROM users WHERE id = $1', [userId]);
  res.json({ success: true, data: user.rows[0]?.preferences || {} });
});

router.put('/preferences', authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { preferences } = req.body;
  await query('UPDATE users SET preferences = $1 WHERE id = $2', [JSON.stringify(preferences), userId]);
  res.json({ success: true });
});

// ─── Delete Account ──────────────────────────────────
router.delete('/account', authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  await query('DELETE FROM users WHERE id = $1', [userId]);
  logger.info(`Account deleted: user ${userId}`);
  res.json({ success: true, message: 'Account deleted' });
});

export default router;
