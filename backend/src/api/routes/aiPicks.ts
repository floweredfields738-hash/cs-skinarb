import express, { Request, Response, NextFunction } from 'express';
import { query, queryMany, queryOne } from '../../utils/database';
import { cacheGet, cacheSet } from '../../utils/cache';
import { logger } from '../../utils/logging';

const router = express.Router();

interface AIPick {
  skinId: number;
  name: string;
  rarity: string;
  category: 'undervalued' | 'trending_up' | 'arbitrage' | 'volume_spike';
  categoryLabel: string;
  currentPrice: number;
  change24h: number;
  aiScore: number;
  confidence: number;
  recommendation: string;
  reasons: string[];
  minFloat: number;
  maxFloat: number;
  // Category-specific data
  arbitrageProfit?: number;
  arbitrageMarkets?: string;
  predicted7d?: number;
  volumeChange?: number;
  priceVsAvg?: number;
  // Market prices for buy/sell info
  markets?: { name: string; price: number; url: string }[];
  cheapestMarket?: string;
  cheapestPrice?: number;
  buyUrl?: string;
}

/**
 * GET /api/ai-picks
 * Combines opportunity scoring, price predictions, and arbitrage detection
 * into categorized, reasoned AI picks.
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cacheKey = 'ai:picks:combined';
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.json({ success: true, data: JSON.parse(cached) });
    }

    const picks: AIPick[] = [];

    // ─── 1. UNDERVALUED — price well below 30d average with decent volume ───
    const undervalued = await queryMany(
      `SELECT s.id, s.name, s.rarity, s.min_float, s.max_float,
              os.overall_score, os.undervaluation_score, os.volume_trend_score,
              ps.avg_price_30d, ps.trading_volume_7d, ps.trading_volume_30d, ps.price_volatility,
              (SELECT MIN(mp.price) FROM market_prices mp WHERE mp.skin_id = s.id AND mp.price > 0) as current_price
       FROM skins s
       JOIN opportunity_scores os ON os.skin_id = s.id
       LEFT JOIN price_statistics ps ON ps.skin_id = s.id
       WHERE os.undervaluation_score >= 60
         AND ps.trading_volume_7d > 3
         AND s.name NOT LIKE 'Sticker |%' AND s.name NOT LIKE '%Capsule%' AND s.name NOT LIKE '%Graffiti%'
         AND (SELECT MIN(mp.price) FROM market_prices mp WHERE mp.skin_id = s.id AND mp.price > 0) >= 5
       ORDER BY os.undervaluation_score DESC, os.overall_score DESC
       LIMIT 3`
    );

    for (const row of undervalued) {
      const price = parseFloat(row.current_price || '0');
      const avg30d = parseFloat(row.avg_price_30d || '0');
      const pctBelow = avg30d > 0 ? ((avg30d - price) / avg30d * 100) : 0;
      const reasons: string[] = [];

      if (pctBelow > 5) reasons.push(`${pctBelow.toFixed(0)}% below 30d avg`);
      if (row.trading_volume_7d > 20) reasons.push(`High volume (${row.trading_volume_7d} trades/7d)`);
      else if (row.trading_volume_7d > 5) reasons.push(`Active trading (${row.trading_volume_7d}/7d)`);
      if (row.price_volatility && row.price_volatility < 40) reasons.push('Low volatility');
      if (row.rarity === 'Covert' || row.rarity === 'Classified') reasons.push(`${row.rarity} rarity`);

      if (reasons.length === 0) reasons.push('Strong opportunity score');

      picks.push({
        skinId: row.id,
        name: row.name,
        rarity: row.rarity,
        category: 'undervalued',
        categoryLabel: 'Undervalued',
        currentPrice: price,
        change24h: 0,
        aiScore: Math.round(row.overall_score),
        confidence: Math.min(95, Math.round(row.undervaluation_score * 0.7 + row.volume_trend_score * 0.3)),
        recommendation: row.overall_score >= 75 ? 'Strong Buy' : 'Buy',
        reasons,
        minFloat: parseFloat(row.min_float || '0'),
        maxFloat: parseFloat(row.max_float || '1'),
        priceVsAvg: -pctBelow,
      });
    }

    // ─── 2. TRENDING UP — prediction engine says price going up ───
    const trending = await queryMany(
      `SELECT s.id, s.name, s.rarity, s.min_float, s.max_float,
              pp.predicted_price, pp.confidence_score, pp.trend_direction,
              pp.prediction_strength, pp.moving_avg_7d, pp.moving_avg_30d,
              pp.volatility_forecast,
              (SELECT MIN(mp.price) FROM market_prices mp WHERE mp.skin_id = s.id AND mp.price > 0) as current_price,
              os.overall_score
       FROM price_predictions pp
       JOIN skins s ON s.id = pp.skin_id
       LEFT JOIN opportunity_scores os ON os.skin_id = s.id
       WHERE pp.trend_direction = 'up'
         AND pp.confidence_score >= 60
         AND pp.prediction_strength IN ('strong', 'moderate')
         AND s.name NOT LIKE 'Sticker |%' AND s.name NOT LIKE '%Capsule%' AND s.name NOT LIKE '%Graffiti%'
         AND (SELECT MIN(mp.price) FROM market_prices mp WHERE mp.skin_id = s.id AND mp.price > 0) >= 5
       ORDER BY pp.confidence_score DESC, pp.predicted_price DESC
       LIMIT 3`
    );

    for (const row of trending) {
      const price = parseFloat(row.current_price || '0');
      const predicted = parseFloat(row.predicted_price || '0');
      const pctUp = price > 0 ? ((predicted - price) / price * 100) : 0;
      const reasons: string[] = [];

      if (pctUp > 2) reasons.push(`Predicted +${pctUp.toFixed(1)}% (7d)`);
      if (row.prediction_strength === 'strong') reasons.push('Strong uptrend');
      else reasons.push('Moderate uptrend');
      if (row.moving_avg_7d > row.moving_avg_30d) reasons.push('7d MA > 30d MA');
      if (row.volatility_forecast && row.volatility_forecast < 30) reasons.push('Low volatility risk');

      if (reasons.length === 0) reasons.push('Positive trend detected');

      picks.push({
        skinId: row.id,
        name: row.name,
        rarity: row.rarity,
        category: 'trending_up',
        categoryLabel: 'Trending Up',
        currentPrice: price,
        change24h: 0,
        aiScore: Math.round((row.confidence_score * 0.6) + ((row.overall_score || 50) * 0.4)),
        confidence: Math.round(row.confidence_score),
        recommendation: row.confidence_score >= 80 ? 'Strong Buy' : 'Buy',
        reasons,
        minFloat: parseFloat(row.min_float || '0'),
        maxFloat: parseFloat(row.max_float || '1'),
        predicted7d: predicted,
      });
    }

    // ─── 3. ARBITRAGE — active cross-market profit opportunities ───
    const arbitrage = await queryMany(
      `SELECT ao.skin_id, s.name, s.rarity, s.min_float, s.max_float,
              ao.source_market_id, ao.target_market_id, ao.buy_price, ao.sell_price,
              ao.net_profit, ao.profit_margin, ao.roi, ao.liquidity_score, ao.risk_level,
              m1.display_name as source_name, m2.display_name as target_name,
              (SELECT MIN(mp.price) FROM market_prices mp WHERE mp.skin_id = s.id AND mp.price > 0) as current_price
       FROM arbitrage_opportunities ao
       JOIN skins s ON s.id = ao.skin_id
       LEFT JOIN markets m1 ON m1.id = ao.source_market_id
       LEFT JOIN markets m2 ON m2.id = ao.target_market_id
       WHERE ao.net_profit > 5
         AND ao.liquidity_score >= 50
         AND s.name NOT LIKE 'Sticker |%' AND s.name NOT LIKE '%Capsule%' AND s.name NOT LIKE '%Graffiti%'
       ORDER BY ao.net_profit DESC
       LIMIT 3`
    );

    for (const row of arbitrage) {
      const profit = parseFloat(row.net_profit || '0');
      const roi = parseFloat(row.roi || '0');
      const reasons: string[] = [];

      reasons.push(`+$${profit.toFixed(2)} profit (${roi.toFixed(1)}% ROI)`);
      const srcName = row.source_name || `Market ${row.source_market_id}`;
      const tgtName = row.target_name || `Market ${row.target_market_id}`;
      reasons.push(`Buy ${srcName} → Sell ${tgtName}`);
      if (row.risk_level === 'low') reasons.push('Low risk');
      else if (row.risk_level === 'medium') reasons.push('Medium risk');
      if (row.liquidity_score >= 80) reasons.push('High liquidity');

      picks.push({
        skinId: row.skin_id,
        name: row.name,
        rarity: row.rarity,
        category: 'arbitrage',
        categoryLabel: 'Arbitrage',
        currentPrice: parseFloat(row.current_price || row.buy_price || '0'),
        change24h: 0,
        aiScore: Math.round(Math.min(99, 50 + roi * 3 + row.liquidity_score * 0.2)),
        confidence: Math.round(row.liquidity_score),
        recommendation: roi >= 10 ? 'Strong Buy' : 'Buy',
        reasons,
        minFloat: parseFloat(row.min_float || '0'),
        maxFloat: parseFloat(row.max_float || '1'),
        arbitrageProfit: profit,
        arbitrageMarkets: `${srcName} → ${tgtName}`,
      });
    }

    // ─── 4. VOLUME SPIKE — sudden increase in trading activity ───
    const volumeSpikes = await queryMany(
      `SELECT s.id, s.name, s.rarity, s.min_float, s.max_float,
              ps.trading_volume_7d, ps.trading_volume_30d, ps.avg_price_7d, ps.avg_price_30d,
              os.overall_score,
              (SELECT MIN(mp.price) FROM market_prices mp WHERE mp.skin_id = s.id AND mp.price > 0) as current_price
       FROM skins s
       JOIN price_statistics ps ON ps.skin_id = s.id
       LEFT JOIN opportunity_scores os ON os.skin_id = s.id
       WHERE ps.trading_volume_7d > 10
         AND ps.trading_volume_30d > 0
         AND (ps.trading_volume_7d::float / GREATEST(ps.trading_volume_30d::float / 4.3, 1)) > 1.5
         AND s.name NOT LIKE 'Sticker |%' AND s.name NOT LIKE '%Capsule%' AND s.name NOT LIKE '%Graffiti%'
         AND (SELECT MIN(mp.price) FROM market_prices mp WHERE mp.skin_id = s.id AND mp.price > 0) >= 5
       ORDER BY (ps.trading_volume_7d::float / GREATEST(ps.trading_volume_30d::float / 4.3, 1)) DESC
       LIMIT 3`
    );

    for (const row of volumeSpikes) {
      const weeklyNorm = row.trading_volume_30d / 4.3;
      const volChange = weeklyNorm > 0 ? ((row.trading_volume_7d - weeklyNorm) / weeklyNorm * 100) : 0;
      const reasons: string[] = [];

      reasons.push(`Volume +${volChange.toFixed(0)}% vs avg`);
      reasons.push(`${row.trading_volume_7d} trades this week`);
      if (row.avg_price_7d > row.avg_price_30d) reasons.push('Price trending up with volume');
      if (row.rarity === 'Covert' || row.rarity === 'Classified') reasons.push(`${row.rarity} rarity`);

      if (reasons.length === 0) reasons.push('Unusual trading activity');

      picks.push({
        skinId: row.id,
        name: row.name,
        rarity: row.rarity,
        category: 'volume_spike',
        categoryLabel: 'Volume Spike',
        currentPrice: parseFloat(row.current_price || '0'),
        change24h: 0,
        aiScore: Math.round(Math.min(95, 40 + volChange * 0.3 + (row.overall_score || 0) * 0.3)),
        confidence: Math.min(90, Math.round(40 + Math.min(volChange, 100) * 0.5)),
        recommendation: volChange > 100 ? 'Strong Buy' : 'Buy',
        reasons,
        minFloat: parseFloat(row.min_float || '0'),
        maxFloat: parseFloat(row.max_float || '1'),
        volumeChange: volChange,
      });
    }

    // ─── Filter out low-value, undesirable, and non-weapon items ───
    const validPicks = picks.filter(p => {
      if (p.currentPrice < 5) return false; // No penny skins
      const nameLower = p.name.toLowerCase();
      if (nameLower.startsWith('sticker |')) return false;
      if (nameLower.includes('capsule')) return false;
      if (nameLower.includes('graffiti')) return false;
      if (nameLower.includes('patch |')) return false;
      if (nameLower.includes('music kit')) return false;
      if (nameLower.includes('pin |')) return false;
      if (nameLower.includes('agent |') || nameLower.includes('| swat') || nameLower.includes('| seal') || nameLower.includes('farlow')) return false; // Agent skins — low demand
      return true;
    });

    // ─── Deduplicate by skinId (keep highest aiScore) ───
    const seen = new Map<number, AIPick>();
    for (const pick of validPicks) {
      const existing = seen.get(pick.skinId);
      if (!existing || pick.aiScore > existing.aiScore) {
        seen.set(pick.skinId, pick);
      }
    }
    const dedupedPicks = Array.from(seen.values())
      .sort((a, b) => b.aiScore - a.aiScore)
      .slice(0, 8);

    // ─── Enrich each pick with market prices + buy/sell URLs ───
    // Prioritize FN > MW > FT. Skip WW and BS — low demand, bad resale.
    const EXTERIOR_PRIORITY: Record<string, number> = {
      'Factory New': 1, 'Minimal Wear': 2, 'Field-Tested': 3,
      'Well-Worn': 99, 'Battle-Scarred': 99,
    };

    for (const pick of dedupedPicks) {
      try {
        const marketPrices = await queryMany(
          `SELECT mp.price, mp.exterior, m.display_name, mp.direct_url
           FROM market_prices mp
           JOIN markets m ON m.id = mp.market_id
           WHERE mp.skin_id = $1 AND mp.price > 0
             AND (mp.exterior IS NULL OR mp.exterior NOT IN ('Well-Worn', 'Battle-Scarred'))
           ORDER BY mp.price ASC
           LIMIT 10`,
          [pick.skinId]
        );

        if (marketPrices.length > 0) {
          pick.markets = marketPrices.map((mp: any) => {
            const mName = (mp.display_name || '').toLowerCase();
            const skinSlug = pick.name.replace(/\s*\|.*/, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const skinQuery = encodeURIComponent(pick.name);
            let url = mp.direct_url || '';

            if (!url) {
              if (mName.includes('steam')) url = `https://steamcommunity.com/market/listings/730/${skinQuery}`;
              else if (mName.includes('skinport')) url = `https://skinport.com/market?search=${skinQuery}&sort=price&order=asc`;
              else if (mName.includes('float')) url = `https://csfloat.com/search?market_hash_name=${skinQuery}`;
              else url = `https://www.google.com/search?q=${skinQuery}+buy`;
            }

            return {
              name: `${mp.display_name}${mp.exterior ? ' (' + mp.exterior + ')' : ''}`,
              price: parseFloat(mp.price),
              url,
            };
          });

          const cheapest = pick.markets[0];
          pick.cheapestMarket = cheapest.name;
          pick.cheapestPrice = cheapest.price;
          pick.buyUrl = cheapest.url;
        }
      } catch { /* skip enrichment on error */ }
    }

    // Cache for 30 seconds
    await cacheSet(cacheKey, JSON.stringify(dedupedPicks), 30);

    res.json({ success: true, data: dedupedPicks });
  } catch (error) {
    logger.error('AI picks error:', error);
    next(error);
  }
});

export default router;
