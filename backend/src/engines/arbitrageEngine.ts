import { queryMany, queryOne, query } from '../utils/database';
import { cacheGet, cacheSet } from '../utils/cache';
import { logger } from '../utils/logging';
import { broadcastArbitrageOpportunity } from '../utils/websocket';

interface ArbitrageOpportunity {
  skinId: number;
  sourceMarket: string;
  targetMarket: string;
  buyPrice: number;
  sellPrice: number;
  grossProfit: number;
  feeCost: number;
  netProfit: number;
  profitMargin: number; // percentage
  roi: number; // percentage
  liquidity: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high';
}

const MARKET_FEES = {
  steam: 0.13,
  buff163: 0.05,
  skinport: 0.10,
  csfloat: 0.03,
};

const MAX_LIQUIDITY_DELAY = {
  steam: 1000, // 1s
  buff163: 500,
  skinport: 300,
  csfloat: 500,
};

/**
 * Arbitrage Detection Engine
 * 
 * Compares prices across multiple markets and finds profitable opportunities
 * Factors in transaction fees and liquidity constraints
 */
export async function detectArbitrageOpportunities(): Promise<ArbitrageOpportunity[]> {
  try {
    logger.info('🔍 Scanning for arbitrage opportunities...');

    // Get all market prices for all skins
    const prices = await queryMany(
      `
      SELECT 
        s.id as skin_id,
        s.name,
        m.name as market_name,
        mp.price,
        mp.quantity,
        mp.volume,
        EXTRACT(EPOCH FROM (NOW() - mp.last_updated))/1000 as age_seconds
      FROM market_prices mp
      JOIN skins s ON mp.skin_id = s.id
      JOIN markets m ON mp.market_id = m.id
      WHERE m.is_active = true
      AND mp.quantity != 0
      ORDER BY s.id, m.name
      `
    );

    const opportunities: ArbitrageOpportunity[] = [];
    const skinsMap = new Map();

    // Group prices by skin
    for (const price of prices) {
      if (!skinsMap.has(price.skin_id)) {
        skinsMap.set(price.skin_id, []);
      }
      skinsMap.get(price.skin_id).push(price);
    }

    // Check each skin for arbitrage opportunities
    for (const [skinId, skinPrices] of skinsMap) {
      const ops = findArbitrageInSkin(skinId, skinPrices);
      opportunities.push(...ops);
    }

    // Sort by profit margin
    opportunities.sort((a, b) => b.profitMargin - a.profitMargin);

    // Store top opportunities in database
    await storeArbitrageOpportunities(opportunities.slice(0, 100));

    // Broadcast new opportunities via WebSocket
    for (const opp of opportunities.slice(0, 10)) {
      broadcastArbitrageOpportunity(opp);
    }

    logger.info(`✓ Found ${opportunities.length} arbitrage opportunities`);
    return opportunities;
  } catch (error) {
    logger.error('Error detecting arbitrage:', error);
    return [];
  }
}

function findArbitrageInSkin(skinId: number, prices: any[]): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = [];

  // Check all market pairs
  for (let i = 0; i < prices.length; i++) {
    for (let j = i + 1; j < prices.length; j++) {
      const p1 = prices[i];
      const p2 = prices[j];

      // Check if p1 is cheaper than p2 (arbitrage: buy p1, sell p2)
      const opp1 = evaluateArbitrage(skinId, p1, p2);
      if (opp1 && opp1.netProfit > 0.50) {
        // Minimum $0.50 profit
        opportunities.push(opp1);
      }

      // Check reverse direction
      const opp2 = evaluateArbitrage(skinId, p2, p1);
      if (opp2 && opp2.netProfit > 0.50) {
        opportunities.push(opp2);
      }
    }
  }

  return opportunities;
}

function evaluateArbitrage(
  skinId: number,
  buyMarket: any,
  sellMarket: any
): ArbitrageOpportunity | null {
  // Only consider if buy price < sell price
  if (buyMarket.price >= sellMarket.price) {
    return null;
  }

  const buyFee = (MARKET_FEES as any)[buyMarket.market_name] || 0;
  const sellFee = (MARKET_FEES as any)[sellMarket.market_name] || 0;

  const buyPrice = buyMarket.price;
  const sellPrice = sellMarket.price;

  // Calculate fees
  const buyFeeAmount = buyPrice * buyFee;
  const sellFeeAmount = sellPrice * sellFee;
  const totalFees = buyFeeAmount + sellFeeAmount;

  // Calculate profits
  const grossProfit = sellPrice - buyPrice;
  const netProfit = grossProfit - totalFees;
  const profitMargin = ((netProfit / buyPrice) * 100);
  const roi = ((netProfit / (buyPrice + buyFeeAmount)) * 100);

  if (netProfit <= 0) return null;

  // Calculate liquidity score
  const buyLiquidity = calculateLiquidity(buyMarket);
  const sellLiquidity = calculateLiquidity(sellMarket);
  const avgLiquidity = (buyLiquidity + sellLiquidity) / 2;

  // Determine risk level
  const riskLevel = determineRiskLevel(buyMarket, sellMarket, avgLiquidity);

  return {
    skinId,
    sourceMarket: buyMarket.market_name,
    targetMarket: sellMarket.market_name,
    buyPrice,
    sellPrice,
    grossProfit: Math.round(grossProfit * 100) / 100,
    feeCost: Math.round(totalFees * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100,
    profitMargin: Math.round(profitMargin * 100) / 100,
    roi: Math.round(roi * 100) / 100,
    liquidity: Math.round(avgLiquidity),
    riskLevel,
  };
}

function calculateLiquidity(market: any): number {
  // Based on volume and age of data
  let score = 100;

  // Reduce score if aged data
  if (market.age_seconds > 300) {
    score -= 50; // 5+ minutes old = much lower confidence
  } else if (market.age_seconds > 60) {
    score -= 25; // 1+ minutes old = lower confidence
  }

  // Reduce score if low volume
  if (market.volume < 5) {
    score -= 30;
  } else if (market.volume < 10) {
    score -= 15;
  }

  return Math.max(0, Math.min(100, score));
}

function determineRiskLevel(
  buyMarket: any,
  sellMarket: any,
  liquidity: number
): 'low' | 'medium' | 'high' {
  // High risk if low liquidity
  if (liquidity < 40) return 'high';

  // High risk if trading to Steam (strict return policy)
  if (sellMarket.market_name === 'steam') return 'high';

  // Medium risk if moderate liquidity
  if (liquidity < 70) return 'medium';

  return 'low';
}

async function storeArbitrageOpportunities(opportunities: ArbitrageOpportunity[]) {
  try {
    for (const opp of opportunities) {
      const sourceMarket = await queryOne('SELECT id FROM markets WHERE name = $1', [
        opp.sourceMarket,
      ]);
      const targetMarket = await queryOne('SELECT id FROM markets WHERE name = $1', [
        opp.targetMarket,
      ]);

      if (!sourceMarket || !targetMarket) continue;

      // Insert or update opportunity (expire old ones after 10 minutes)
      await query(
        `
        INSERT INTO arbitrage_opportunities 
        (skin_id, source_market_id, target_market_id, buy_price, sell_price, 
         gross_profit, fee_cost, net_profit, profit_margin, roi, liquidity_score, risk_level, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW() + INTERVAL '10 minutes')
        `,
        [
          opp.skinId,
          sourceMarket.id,
          targetMarket.id,
          opp.buyPrice,
          opp.sellPrice,
          opp.grossProfit,
          opp.feeCost,
          opp.netProfit,
          opp.profitMargin,
          opp.roi,
          opp.liquidity,
          opp.riskLevel,
        ]
      );
    }

    logger.info(`✓ Stored ${opportunities.length} arbitrage opportunities`);
  } catch (error) {
    logger.error('Error storing arbitrage opportunities:', error);
  }
}

export async function getTopArbitrageOpportunities(limit: number = 20) {
  try {
    return await queryMany(
      `
      SELECT 
        ao.*,
        s.name as skin_name,
        m1.name as source_market,
        m2.name as target_market
      FROM arbitrage_opportunities ao
      JOIN skins s ON ao.skin_id = s.id
      JOIN markets m1 ON ao.source_market_id = m1.id
      JOIN markets m2 ON ao.target_market_id = m2.id
      WHERE ao.is_active = true
      AND ao.expires_at > NOW()
      ORDER BY ao.profit_margin DESC
      LIMIT $1
      `,
      [limit]
    );
  } catch (error) {
    logger.error('Error fetching arbitrage opportunities:', error);
    return [];
  }
}
