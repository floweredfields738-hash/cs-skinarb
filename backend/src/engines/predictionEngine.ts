import { queryMany, queryOne, query } from '../utils/database';
import { logger } from '../utils/logging';

interface PricePrediction {
  skinId: number;
  predictedPrice: number;
  confidence: number; // 0-100
  trendDirection: 'up' | 'down' | 'stable';
  trendStrength: 'strong' | 'moderate' | 'weak';
  movingAvg7d: number;
  movingAvg30d: number;
  volatility: number;
  recommendation: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'overvalued';
}

/**
 * Price Prediction Engine
 * Uses moving averages, trend analysis, and volatility to forecast prices
 */
export async function predictPrice(skinId: number): Promise<PricePrediction | null> {
  try {
    // Get price history for the past 30 days
    const history = await getPriceHistory(skinId, 30);
    if (!history || history.length < 7) {
      logger.warn('Insufficient price history for prediction', { skinId });
      return null;
    }

    // Calculate moving averages
    const ma7 = calculateMovingAverage(history, 7);
    const ma30 = calculateMovingAverage(history, 30);

    // Calculate volatility
    const volatility = calculateVolatility(history);

    // Determine trend
    const trend = determineTrend(history, ma7, ma30);

    // Calculate predicted price for next day
    const predictedPrice = calculateNextPricePoint(history, ma7, ma30, trend);

    // Calculate confidence based on data quality
    const confidence = calculateConfidence(history, volatility);

    // Determine recommendation
    const recommendation = getRecommendation(predictedPrice, ma30, volatility);

    return {
      skinId,
      predictedPrice: Math.round(predictedPrice * 100) / 100,
      confidence: Math.round(confidence),
      trendDirection: trend.direction,
      trendStrength: trend.strength,
      movingAvg7d: Math.round(ma7 * 100) / 100,
      movingAvg30d: Math.round(ma30 * 100) / 100,
      volatility: Math.round(volatility * 100) / 100,
      recommendation,
    };
  } catch (error) {
    logger.error('Error predicting price:', { skinId, error });
    return null;
  }
}

async function getPriceHistory(skinId: number, days: number) {
  try {
    return await queryMany(
      `
      SELECT 
        price,
        timestamp,
        EXTRACT(EPOCH FROM NOW() - timestamp)/86400 as days_ago
      FROM price_history
      WHERE skin_id = $1
      AND timestamp >= NOW() - ($2 || ' days')::interval
      ORDER BY timestamp ASC
      `,
      [skinId, days]
    );
  } catch (error) {
    logger.error('Error fetching price history:', { skinId, error });
    return [];
  }
}

function calculateMovingAverage(history: any[], days: number): number {
  const subset = history.filter((h) => h.days_ago <= days);
  if (subset.length === 0) return 0;

  const sum = subset.reduce((acc, h) => acc + parseFloat(h.price), 0);
  return sum / subset.length;
}

function calculateVolatility(history: any[]): number {
  const prices = history.map((h) => parseFloat(h.price));
  const mean = prices.reduce((a, b) => a + b) / prices.length;

  const squaredDiffs = prices.map((p) => Math.pow(p - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b) / squaredDiffs.length;
  const stdDev = Math.sqrt(avgSquaredDiff);

  // Convert to percentage
  return (stdDev / mean) * 100;
}

function determineTrend(history: any[], ma7: number, ma30: number) {
  const latest = parseFloat(history[history.length - 1].price);
  const oldest = parseFloat(history[0].price);

  const priceChange = ((latest - oldest) / oldest) * 100;

  // Compare moving averages
  const maDiff = ma7 - ma30;
  const maPercentDiff = (maDiff / ma30) * 100;

  let direction: 'up' | 'down' | 'stable' = 'stable';
  let strength: 'strong' | 'moderate' | 'weak' = 'weak';

  if (maPercentDiff > 2) {
    direction = 'up';
  } else if (maPercentDiff < -2) {
    direction = 'down';
  }

  // Determine strength
  if (Math.abs(maPercentDiff) > 5) {
    strength = 'strong';
  } else if (Math.abs(maPercentDiff) > 2) {
    strength = 'moderate';
  }

  return { direction, strength };
}

function calculateNextPricePoint(
  history: any[],
  ma7: number,
  ma30: number,
  trend: any
): number {
  const latest = parseFloat(history[history.length - 1].price);

  // Weighted average of latest price, MA7, and projected trend
  let predicted = latest * 0.4 + ma7 * 0.4 + ma30 * 0.2;

  // Apply trend adjustment
  if (trend.direction === 'up') {
    const adjustment = trend.strength === 'strong' ? 0.02 : 0.01;
    predicted *= 1 + adjustment;
  } else if (trend.direction === 'down') {
    const adjustment = trend.strength === 'strong' ? -0.02 : -0.01;
    predicted *= 1 + adjustment;
  }

  return predicted;
}

function calculateConfidence(history: any[], volatility: number): number {
  let confidence = 75; // Base confidence

  // Reduce confidence if high volatility
  if (volatility > 15) {
    confidence -= 25;
  } else if (volatility > 10) {
    confidence -= 15;
  }

  // Reduce confidence if low sample size
  if (history.length < 15) {
    confidence -= 20;
  }

  return Math.max(20, Math.min(95, confidence));
}

function getRecommendation(
  predictedPrice: number,
  ma30: number,
  volatility: number
): 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'overvalued' {
  const percentChange = ((predictedPrice - ma30) / ma30) * 100;

  // If predicted price is much lower: buy signals
  if (percentChange < -8) return 'strong_buy';
  if (percentChange < -4) return 'buy';

  // If predicted price is neutral
  if (percentChange > -4 && percentChange < 4) return 'neutral';

  // If predicted price is much higher: sell signals
  if (percentChange > 8) return 'overvalued';
  if (percentChange > 4) return 'sell';

  return 'neutral';
}

export async function predictAllPrices() {
  try {
    logger.info('🔮 Starting price predictions...');

    const skins = await queryMany('SELECT id FROM skins LIMIT 500');
    let successCount = 0;
    let errorCount = 0;

    for (const skin of skins) {
      try {
        const prediction = await predictPrice(skin.id);
        if (prediction) {
          await storePrediction(prediction);
          successCount++;
        }
      } catch (error) {
        errorCount++;
        logger.error('Error predicting price for skin:', { skinId: skin.id, error });
      }
    }

    logger.info('✓ Price predictions complete', { successCount, errorCount });
  } catch (error) {
    logger.error('Error in predictAllPrices:', error);
  }
}

async function storePrediction(prediction: PricePrediction) {
  try {
    await query(
      `
      INSERT INTO price_predictions 
      (skin_id, prediction_date, predicted_price, confidence_score, 
       trend_direction, prediction_strength, moving_avg_7d, moving_avg_30d, volatility_forecast)
      VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (skin_id, prediction_date) 
      DO UPDATE SET 
        predicted_price = $2,
        confidence_score = $3,
        trend_direction = $4,
        prediction_strength = $5,
        moving_avg_7d = $6,
        moving_avg_30d = $7,
        volatility_forecast = $8
      `,
      [
        prediction.skinId,
        prediction.predictedPrice,
        prediction.confidence,
        prediction.trendDirection,
        prediction.trendStrength,
        prediction.movingAvg7d,
        prediction.movingAvg30d,
        prediction.volatility,
      ]
    );
  } catch (error) {
    logger.error('Error storing prediction:', error);
  }
}
