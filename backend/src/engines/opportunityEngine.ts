import { queryOne, queryMany } from '../utils/database';
import { cacheGet, cacheSet } from '../utils/cache';
import { logger } from '../utils/logging';

/**
 * CSkinArb - Opportunity Scoring Engine
 * 
 * Generates AI opportunity scores 0-100 based on:
 * - Undervaluation (35%): How much cheaper vs historical average
 * - Volume Trend (20%): Change in trading volume
 * - Rarity Weight (15%): Rarity tier multiplier
 * - Case Popularity (15%): Case demand index
 * - Float Rarity (15%): How rare the float value is
 */

interface SkinMetrics {
  skinId: number;
  currentPrice: number;
  avgPrice30d: number;
  avgPrice7d: number;
  volume7d: number;
  volume30d: number;
  rarity: string;
  casePopularity: number;
  floatValue: number;
}

interface OpportunityScore {
  skinId: number;
  overallScore: number;
  undervaluationScore: number;
  volumeTrendScore: number;
  rarityWeightScore: number;
  casePopularityScore: number;
  floatRarityScore: number;
  recommendation: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'avoid';
}

const RARITY_WEIGHTS = {
  'Covert': 1.50,
  'Classified': 1.25,
  'Restricted': 1.00,
  'Mil-Spec': 0.75,
  'Industrial Grade': 0.50,
  'Consumer Grade': 0.25,
};

const RECOMMENDATION_THRESHOLDS = {
  strong_buy: 75,
  buy: 60,
  neutral: 40,
  sell: 20,
  avoid: 0,
};

export async function calculateOpportunityScore(skinId: number): Promise<OpportunityScore> {
  try {
    // Try cache first
    const cacheKey = `opportunity_score:${skinId}`;
    const cached = await cacheGet<OpportunityScore>(cacheKey);
    if (cached) {
      return cached;
    }

    const metrics = await getMeticsForSkin(skinId);
    if (!metrics) {
      throw new Error(`No metrics found for skin ${skinId}`);
    }

    // Calculate individual scores
    const undervaluationScore = calculateUndervaluationScore(metrics);
    const volumeTrendScore = calculateVolumeTrendScore(metrics);
    const rarityWeightScore = calculateRarityScore(metrics.rarity);
    const casePopularityScore = metrics.casePopularity || 50;
    const floatRarityScore = calculateFloatRarityScore(metrics.floatValue);

    // Calculate weighted overall score
    const overallScore =
      (undervaluationScore * 0.35) +
      (volumeTrendScore * 0.20) +
      (rarityWeightScore * 0.15) +
      (casePopularityScore * 0.15) +
      (floatRarityScore * 0.15);

    // Determine recommendation
    const recommendation = getRecommendation(overallScore);

    const result: OpportunityScore = {
      skinId,
      overallScore: Math.round(overallScore * 100) / 100,
      undervaluationScore: Math.round(undervaluationScore * 100) / 100,
      volumeTrendScore: Math.round(volumeTrendScore * 100) / 100,
      rarityWeightScore: Math.round(rarityWeightScore * 100) / 100,
      casePopularityScore: Math.round(casePopularityScore * 100) / 100,
      floatRarityScore: Math.round(floatRarityScore * 100) / 100,
      recommendation,
    };

    // Cache for 1 hour
    await cacheSet(cacheKey, result, 600); // 10 min cache instead of 1 hour

    // Persist to database
    await queryOne(
      `INSERT INTO opportunity_scores (skin_id, overall_score, undervaluation_score, volume_trend_score,
         rarity_weight_score, case_popularity_score, float_rarity_score, recommendation, calculated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (skin_id) DO UPDATE SET
         overall_score = $2, undervaluation_score = $3, volume_trend_score = $4,
         rarity_weight_score = $5, case_popularity_score = $6, float_rarity_score = $7,
         recommendation = $8, calculated_at = NOW()`,
      [skinId, result.overallScore, result.undervaluationScore, result.volumeTrendScore,
       result.rarityWeightScore, result.casePopularityScore, result.floatRarityScore, result.recommendation]
    );

    return result;
  } catch (error) {
    logger.error('Error calculating opportunity score:', { skinId, error });
    throw error;
  }
}

function calculateUndervaluationScore(metrics: SkinMetrics): number {
  // Percentage below 30-day average
  if (metrics.avgPrice30d === 0) return 50;

  const percentageBelow = ((metrics.avgPrice30d - metrics.currentPrice) / metrics.avgPrice30d) * 100;

  // Map to 0-100 scale
  // 0% below = 0 score
  // 30% below = 50 score
  // 50%+ below = 100 score
  if (percentageBelow <= 0) return 0;
  if (percentageBelow >= 50) return 100;
  return (percentageBelow / 50) * 100;
}

function calculateVolumeTrendScore(metrics: SkinMetrics): number {
  // Compare 7d vs 30d volume trend
  if (metrics.volume30d === 0) return 50;

  const volumeGrowth = ((metrics.volume7d - (metrics.volume30d / 4.29)) / (metrics.volume30d / 4.29)) * 100;

  // Map to 0-100 scale
  // -50% volume = 0 score (declining trend)
  // 0% volume = 50 score (stable)
  // +100% volume = 100 score (increasing trend)
  const score = 50 + (volumeGrowth / 2);
  return Math.max(0, Math.min(100, score));
}

function calculateRarityScore(rarity: string): number {
  const weight = (RARITY_WEIGHTS as any)[rarity] || 0.5;
  // Scale 0.25-1.50 to 0-100
  return ((weight - 0.25) / 1.25) * 100;
}

function calculateFloatRarityScore(floatValue: number): number {
  // Lower float values are rarer and more valuable
  // Perfect condition (0.0) = 100 score
  // Field-tested (0.35) = 50 score
  // Battle-scarred (1.0) = 0 score
  if (floatValue <= 0.07) return 100; // Factory New
  if (floatValue <= 0.14) return 90;  // Minimal Wear
  if (floatValue <= 0.37) return 70;  // Field-Tested
  if (floatValue <= 0.81) return 40;  // Well-Worn
  return 10; // Battle-Scarred
}

function getRecommendation(
  score: number
): 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'avoid' {
  if (score >= RECOMMENDATION_THRESHOLDS.strong_buy) return 'strong_buy';
  if (score >= RECOMMENDATION_THRESHOLDS.buy) return 'buy';
  if (score >= RECOMMENDATION_THRESHOLDS.neutral) return 'neutral';
  if (score >= RECOMMENDATION_THRESHOLDS.sell) return 'sell';
  return 'avoid';
}

async function getMeticsForSkin(skinId: number): Promise<SkinMetrics | null> {
  try {
    // Get skin data with current market prices
    const skin = await queryOne(
      `
      SELECT 
        s.id,
        s.rarity,
        s.case_name,
        AVG(mp.price) as current_price,
        ps.avg_price_30d,
        ps.avg_price_7d,
        ps.trading_volume_7d,
        ps.trading_volume_30d,
        cp.performance_score as case_popularity
      FROM skins s
      LEFT JOIN market_prices mp ON s.id = mp.skin_id
      LEFT JOIN price_statistics ps ON s.id = ps.skin_id
      LEFT JOIN case_performance cp ON s.case_name = cp.case_name
      WHERE s.id = $1
      GROUP BY s.id, s.rarity, s.case_name, ps.avg_price_30d, ps.avg_price_7d,
               ps.trading_volume_7d, ps.trading_volume_30d, cp.performance_score
      `,
      [skinId]
    );

    if (!skin) return null;

    return {
      skinId: skin.id,
      currentPrice: parseFloat(skin.current_price) || 0,
      avgPrice30d: parseFloat(skin.avg_price_30d) || 0,
      avgPrice7d: parseFloat(skin.avg_price_7d) || 0,
      volume7d: skin.trading_volume_7d || 0,
      volume30d: skin.trading_volume_30d || 0,
      rarity: skin.rarity,
      casePopularity: skin.case_popularity || 50,
      floatValue: skin.min_float ? (parseFloat(skin.min_float) + parseFloat(skin.max_float || '1')) / 2 : 0.15, // midpoint of skin's float range
    };
  } catch (error) {
    logger.error('Error getting skin metrics:', { skinId, error });
    return null;
  }
}

export async function recalculateAllScores() {
  try {
    logger.info('🔄 Starting opportunity score recalculation...');

    const skins = await queryMany('SELECT id FROM skins LIMIT 1000');
    let successCount = 0;
    let errorCount = 0;

    for (const skin of skins) {
      try {
        await calculateOpportunityScore(skin.id);
        successCount++;
      } catch (error) {
        errorCount++;
        logger.error('Error calculating score for skin:', { skinId: skin.id, error });
      }
    }

    logger.info('✓ Opportunity scores recalculated', { successCount, errorCount });
  } catch (error) {
    logger.error('Error in recalculateAllScores:', error);
  }
}
