import { queryMany, queryOne, query } from '../utils/database';
import { logger } from '../utils/logging';

interface PricePrediction {
  skinId: number;
  skinName: string;
  currentPrice: number;
  predicted7d: number;
  predicted30d: number;
  predictedPrice: number; // backwards compat — same as predicted7d
  confidence: number;
  direction: 'up' | 'down' | 'stable';
  trendDirection: 'up' | 'down' | 'stable'; // backwards compat
  trendStrength: 'strong' | 'moderate' | 'weak';
  movingAvg7d: number;
  movingAvg30d: number;
  volatility: number;
  recommendation: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'overvalued';
  signals: string[];
  factors: {
    trendMomentum: number;
    volumeSignal: number;
    meanReversion: number;
    volatilityRisk: number;
    rarityPremium: number;
  };
}

const RARITY_STABILITY: Record<string, number> = {
  'Covert': 0.85, 'Classified': 0.75, 'Restricted': 0.65,
  'Mil-Spec': 0.50, 'Industrial Grade': 0.40, 'Consumer Grade': 0.30,
  'Extraordinary': 0.90,
};

export async function predictPrice(skinId: number): Promise<PricePrediction | null> {
  try {
    const skin = await queryOne(
      `SELECT s.id, s.name, s.rarity,
              ps.avg_price_7d, ps.avg_price_30d,
              ps.min_price_7d, ps.max_price_7d,
              ps.min_price_30d, ps.max_price_30d,
              ps.trading_volume_7d, ps.trading_volume_30d,
              ps.price_volatility,
              (SELECT MIN(mp.price) FROM market_prices mp WHERE mp.skin_id = s.id AND mp.price > 0) as current_price
       FROM skins s
       LEFT JOIN price_statistics ps ON ps.skin_id = s.id
       WHERE s.id = $1`,
      [skinId]
    );

    if (!skin || !skin.current_price) return null;

    const currentPrice = parseFloat(skin.current_price);
    const avg7d = parseFloat(skin.avg_price_7d) || currentPrice;
    const avg30d = parseFloat(skin.avg_price_30d) || currentPrice;
    const vol7d = parseInt(skin.trading_volume_7d) || 0;
    const vol30d = parseInt(skin.trading_volume_30d) || 0;
    const volatility = parseFloat(skin.price_volatility) || 0;
    const rarity = skin.rarity || 'Mil-Spec';
    const signals: string[] = [];

    // ═══ FACTOR 1: Trend Momentum ═══
    let trendMomentum = 0;
    if (avg30d > 0) {
      const shortVsLong = ((avg7d - avg30d) / avg30d) * 100;
      trendMomentum = Math.max(-100, Math.min(100, shortVsLong * 5));
      if (shortVsLong > 5) signals.push('7-day average above 30-day — uptrend');
      else if (shortVsLong < -5) signals.push('7-day average below 30-day — downtrend');
    }
    if (avg7d > 0) {
      const cvsa = ((currentPrice - avg7d) / avg7d) * 100;
      if (cvsa > 10) signals.push(`${cvsa.toFixed(1)}% above weekly average`);
      else if (cvsa < -10) signals.push(`${Math.abs(cvsa).toFixed(1)}% below weekly average — potential undervalue`);
    }

    // ═══ FACTOR 2: Volume Signal ═══
    let volumeSignal = 0;
    if (vol30d > 0) {
      const weeklyNorm = vol30d / 4.29;
      const volChange = weeklyNorm > 0 ? ((vol7d - weeklyNorm) / weeklyNorm) * 100 : 0;
      volumeSignal = Math.max(-100, Math.min(100, volChange * 2));
      if (volChange > 30) signals.push('Volume spike — increased interest');
      else if (volChange < -30) signals.push('Volume declining — reduced interest');
    }

    // ═══ FACTOR 3: Mean Reversion ═══
    let meanReversion = 0;
    if (avg30d > 0) {
      const devPct = ((currentPrice - avg30d) / avg30d) * 100;
      meanReversion = Math.max(-100, Math.min(100, -devPct * 3));
      if (devPct < -15) signals.push('Well below 30-day average — reversion likely');
      else if (devPct > 15) signals.push('Well above 30-day average — may pull back');
    }

    // ═══ FACTOR 4: Volatility Risk ═══
    const volatilityRisk = Math.min(100, volatility);
    if (volatility > 50) signals.push('High volatility — prediction less reliable');

    // ═══ FACTOR 5: Rarity Premium ═══
    const stability = RARITY_STABILITY[rarity] || 0.5;
    const rarityPremium = stability * 100;
    if (stability >= 0.85) signals.push('High rarity — prices tend to hold');

    // ═══ COMBINE → PREDICTION ═══
    // Rarity acts as a dampener (stabilizes predictions), not a directional bias
    // Mean reversion gets higher weight when trend is weak, lower when trend is strong
    const trendStrengthAbs = Math.abs(trendMomentum);
    const meanRevWeight = trendStrengthAbs > 50 ? 0.15 : 0.30; // reduce mean reversion when trend is strong
    const trendWeight = trendStrengthAbs > 50 ? 0.45 : 0.30;   // increase trend weight when strong

    const composite =
      (trendMomentum * trendWeight) +
      (volumeSignal * 0.20) +
      (meanReversion * meanRevWeight) +
      (-volatilityRisk * 0.15);

    // Rarity dampens the magnitude — high rarity = less extreme predictions
    const rarityDampener = 0.5 + (stability * 0.5); // 0.65 to 0.95
    const changePct7d = (composite / 100) * 10 * rarityDampener;
    const changePct30d = (composite / 100) * 20 * rarityDampener;

    const predicted7d = Math.round(currentPrice * (1 + changePct7d / 100) * 100) / 100;
    const predicted30d = Math.round(currentPrice * (1 + changePct30d / 100) * 100) / 100;

    const direction = changePct7d > 2 ? 'up' : changePct7d < -2 ? 'down' : 'stable';
    const strength: 'strong' | 'moderate' | 'weak' = Math.abs(changePct7d) > 5 ? 'strong' : Math.abs(changePct7d) > 2 ? 'moderate' : 'weak';

    // Confidence
    let confidence = 50;
    if (vol7d > 10) confidence += 10;
    if (vol30d > 50) confidence += 10;
    if (volatility < 30) confidence += 10;
    if (volatility > 100) confidence -= 20;
    if (avg7d > 0 && avg30d > 0) confidence += 10;
    confidence = Math.max(10, Math.min(95, confidence));

    // Recommendation based on predicted movement + current position
    const predictedChange = changePct7d;
    const recommendation: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'overvalued' =
      predictedChange > 6 ? 'strong_buy' :
      predictedChange > 2 ? 'buy' :
      predictedChange < -6 ? 'overvalued' :
      predictedChange < -2 ? 'sell' :
      'neutral';

    if (signals.length === 0) signals.push('Insufficient data for strong signals');

    return {
      skinId, skinName: skin.name, currentPrice,
      predicted7d, predicted30d, predictedPrice: predicted7d,
      confidence, direction, trendDirection: direction, trendStrength: strength,
      movingAvg7d: avg7d, movingAvg30d: avg30d, volatility,
      recommendation, signals,
      factors: {
        trendMomentum: Math.round(trendMomentum), volumeSignal: Math.round(volumeSignal),
        meanReversion: Math.round(meanReversion), volatilityRisk: Math.round(volatilityRisk),
        rarityPremium: Math.round(rarityPremium),
      },
    };
  } catch (error: any) {
    logger.error(`Prediction error for skin ${skinId}:`, error.message);
    return null;
  }
}

export async function predictAllPrices() {
  try {
    logger.info('🔮 Starting price predictions...');
    const skins = await queryMany(
      `SELECT s.id FROM skins s
       JOIN price_statistics ps ON ps.skin_id = s.id
       WHERE ps.trading_volume_7d > 0 LIMIT 500`
    );
    let ok = 0, fail = 0;
    for (const skin of skins) {
      try {
        const pred = await predictPrice(skin.id);
        if (pred) {
          await query(
            `INSERT INTO price_predictions
             (skin_id, prediction_date, predicted_price, confidence_score,
              trend_direction, prediction_strength, moving_avg_7d, moving_avg_30d, volatility_forecast)
             VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (skin_id, prediction_date) DO UPDATE SET
               predicted_price = $2, confidence_score = $3, trend_direction = $4,
               prediction_strength = $5, moving_avg_7d = $6, moving_avg_30d = $7, volatility_forecast = $8`,
            [pred.skinId, pred.predicted7d, pred.confidence, pred.direction,
             pred.trendStrength, pred.movingAvg7d, pred.movingAvg30d, pred.volatility]
          );
          ok++;
        }
      } catch { fail++; }
    }
    logger.info(`✓ Predictions: ${ok} generated, ${fail} failed`);
  } catch (error: any) { logger.error('Predict all error:', error.message); }
}
