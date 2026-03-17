import express, { Request, Response, NextFunction } from 'express';
import { query, queryOne } from '../../utils/database';
import { authMiddleware } from '../../middleware/auth';
import { logger } from '../../utils/logging';

const router = express.Router();

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Price IDs — set these after creating products in Stripe Dashboard
const PRICES = {
  monthly: process.env.STRIPE_PRICE_MONTHLY || '',  // $9.99/mo
  yearly: process.env.STRIPE_PRICE_YEARLY || '',     // $79.99/yr
};

// Free tier limits
export const TIER_LIMITS = {
  free: {
    arbitrageVisible: 5,
    alertsMax: 3,
    apiRequestsDay: 100,
    historyDays: 7,
    instantAlerts: false,
    autoSniper: false,
    backtester: false,
  },
  premium: {
    arbitrageVisible: 9999,
    alertsMax: 50,
    apiRequestsDay: 5000,
    historyDays: 90,
    instantAlerts: true,
    autoSniper: true,
    backtester: true,
  },
};

// ─── Get user's subscription status ──────────────────
router.get('/status', authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const user = await queryOne(
    'SELECT premium_tier, premium_expires, stripe_subscription_id FROM users WHERE id = $1',
    [userId]
  );

  const tier = user?.premium_tier || 'free';
  const isActive = tier === 'premium' && user?.premium_expires && new Date(user.premium_expires) > new Date();

  res.json({
    success: true,
    tier: isActive ? 'premium' : 'free',
    expires: user?.premium_expires || null,
    hasSubscription: !!user?.stripe_subscription_id,
    limits: isActive ? TIER_LIMITS.premium : TIER_LIMITS.free,
  });
});

// ─── Create Stripe checkout session ──────────────────
router.post('/checkout', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  if (!STRIPE_SECRET) {
    return res.status(503).json({ success: false, error: 'Billing not configured. Add Stripe keys to activate.' });
  }

  try {
    const userId = (req as any).userId;
    const { plan } = req.body; // 'monthly' or 'yearly'
    const priceId = plan === 'yearly' ? PRICES.yearly : PRICES.monthly;

    if (!priceId) {
      return res.status(400).json({ success: false, error: 'Price not configured in Stripe' });
    }

    const user = await queryOne('SELECT id, email, stripe_customer_id FROM users WHERE id = $1', [userId]);
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(STRIPE_SECRET);

    // Get or create Stripe customer
    let customerId = user?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user?.email || undefined,
        metadata: { userId: String(userId) },
      });
      customerId = customer.id;
      await query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [customerId, userId]);
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${FRONTEND_URL}/settings?billing=success`,
      cancel_url: `${FRONTEND_URL}/settings?billing=cancelled`,
      metadata: { userId: String(userId) },
    });

    res.json({ success: true, url: session.url });
  } catch (error: any) {
    logger.error('Stripe checkout error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to create checkout session' });
  }
});

// ─── Cancel subscription ────────────────────────────
router.post('/cancel', authMiddleware, async (req: Request, res: Response) => {
  if (!STRIPE_SECRET) return res.status(503).json({ success: false, error: 'Billing not configured' });

  try {
    const userId = (req as any).userId;
    const user = await queryOne('SELECT stripe_subscription_id FROM users WHERE id = $1', [userId]);

    if (!user?.stripe_subscription_id) {
      return res.json({ success: false, error: 'No active subscription' });
    }

    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(STRIPE_SECRET);

    await stripe.subscriptions.update(user.stripe_subscription_id, {
      cancel_at_period_end: true,
    });

    logger.info(`Subscription cancelled for user ${userId}`);
    res.json({ success: true, message: 'Subscription will end at current billing period' });
  } catch (error: any) {
    logger.error('Stripe cancel error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to cancel' });
  }
});

// ─── Stripe webhook ─────────────────────────────────
router.post('/webhook', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  if (!STRIPE_SECRET || !STRIPE_WEBHOOK_SECRET) return res.status(200).send('OK');

  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(STRIPE_SECRET);

    const sig = req.headers['stripe-signature'] as string;
    const event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        const userId = session.metadata?.userId;
        if (userId) {
          await query(
            `UPDATE users SET premium_tier = 'premium', stripe_subscription_id = $1,
             premium_expires = NOW() + INTERVAL '30 days' WHERE id = $2`,
            [session.subscription, userId]
          );
          logger.info(`Premium activated for user ${userId}`);
        }
        break;
      }
      case 'invoice.paid': {
        const invoice = event.data.object as any;
        const subId = invoice.subscription;
        if (subId) {
          await query(
            `UPDATE users SET premium_expires = NOW() + INTERVAL '30 days'
             WHERE stripe_subscription_id = $1`,
            [subId]
          );
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as any;
        await query(
          `UPDATE users SET premium_tier = 'free', stripe_subscription_id = NULL
           WHERE stripe_subscription_id = $1`,
          [sub.id]
        );
        logger.info(`Subscription ended: ${sub.id}`);
        break;
      }
    }

    res.status(200).send('OK');
  } catch (error: any) {
    logger.error('Webhook error:', error.message);
    res.status(400).send('Webhook error');
  }
});

export default router;
