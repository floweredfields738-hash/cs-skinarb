import { Pool } from 'pg';
import { createClient } from 'redis';
import { calculateOpportunityScore, recalculateAllScores } from '../../backend/src/engines/opportunityEngine';
import { detectArbitrageOpportunities } from '../../backend/src/engines/arbitrageEngine';
import { predictAllPrices } from '../../backend/src/engines/predictionEngine';

const db = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost/cs-skin-platform'
});

const redis = createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379')
});

/**
 * Process all skins through opportunity scoring engine
 */
export async function processOpportunityScores(): Promise<void> {
  try {
    console.log('[OPPORTUNITY] Starting opportunity score calculation...');
    const startTime = Date.now();

    // Get all skins with recent market data
    const result = await db.query(
      `SELECT id FROM skins 
       WHERE last_updated >= NOW() - INTERVAL '1 hour'
       ORDER BY volume_7d DESC
       LIMIT 1000`
    );

    const skinIds = result.rows.map(r => r.id);
    console.log(`[OPPORTUNITY] Processing ${skinIds.length} skins`);

    let processed = 0;
    for (const skinId of skinIds) {
      try {
        await calculateOpportunityScore(skinId);
        processed++;

        if (processed % 100 === 0) {
          console.log(`[OPPORTUNITY] Progress: ${processed}/${skinIds.length}`);
        }
      } catch (err) {
        console.error(`[OPPORTUNITY] Error processing skin ${skinId}:`, err);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[OPPORTUNITY] Completed ${processed} scores in ${duration}s`);
  } catch (err) {
    console.error('[OPPORTUNITY] Fatal error:', err);
  }
}

/**
 * Process all skins through arbitrage detection engine
 */
export async function processArbitrageDetection(): Promise<void> {
  try {
    console.log('[ARBITRAGE] Starting arbitrage detection...');
    const startTime = Date.now();

    // Run arbitrage detection
    const opportunities = await detectArbitrageOpportunities();

    // Store top opportunities in database
    if (opportunities.length > 0) {
      const query = `
        INSERT INTO arbitrage_opportunities 
        (skin_id, source_market, target_market, buy_price, sell_price, 
         net_profit, profit_margin, roi, liquidity_score, risk_level, 
         expires_at, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW() + INTERVAL '10 minutes', NOW())
        ON CONFLICT (skin_id, source_market, target_market) DO UPDATE SET
          buy_price = EXCLUDED.buy_price,
          sell_price = EXCLUDED.sell_price,
          net_profit = EXCLUDED.net_profit,
          profit_margin = EXCLUDED.profit_margin,
          roi = EXCLUDED.roi,
          liquidity_score = EXCLUDED.liquidity_score,
          risk_level = EXCLUDED.risk_level,
          expires_at = EXCLUDED.expires_at
      `;

      for (const opp of opportunities.slice(0, 100)) {
        await db.query(query, [
          opp.skinId,
          opp.sourceMarket,
          opp.targetMarket,
          opp.buyPrice,
          opp.sellPrice,
          opp.netProfit,
          opp.profitMargin,
          opp.roi,
          opp.liquidity,
          opp.riskLevel,
        ]);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[ARBITRAGE] Found ${opportunities.length} opportunities in ${duration}s`);
  } catch (err) {
    console.error('[ARBITRAGE] Fatal error:', err);
  }
}

/**
 * Process all skins through price prediction engine
 */
export async function processPricePredictions(): Promise<void> {
  try {
    console.log('[PREDICTION] Starting price predictions...');
    const startTime = Date.now();

    // predictAllPrices() internally fetches and processes all skins
    await predictAllPrices();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[PREDICTION] Completed predictions in ${duration}s`);
  } catch (err) {
    console.error('[PREDICTION] Fatal error:', err);
  }
}

/**
 * Process all data engines
 */
export async function processAllEngines(): Promise<void> {
  try {
    console.log('\n========================================');
    console.log('Starting Data Processing at', new Date().toISOString());
    console.log('========================================\n');

    // Run engines in sequence (not parallel, to avoid DB overload)
    await processOpportunityScores();
    console.log('');
    
    await processArbitrageDetection();
    console.log('');
    
    await processPricePredictions();
    console.log('');

    console.log('✓ All data processing completed\n');
  } catch (err) {
    console.error('Fatal processing error:', err);
  }
}

/**
 * Schedule regular processing
 */
export function startDataProcessingScheduler(): void {
  const PROCESSING_INTERVAL = parseInt(process.env.DATA_PROCESSING_INTERVAL || '600000'); // 10 minutes default

  console.log(`Data processing scheduled every ${PROCESSING_INTERVAL / 1000}s`);

  // Run immediately on start
  processAllEngines().catch(err => console.error('Initial processing failed:', err));

  // Then schedule at intervals
  setInterval(() => {
    processAllEngines().catch(err => console.error('Scheduled processing failed:', err));
  }, PROCESSING_INTERVAL);
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\nShutting down data processor...');
  await db.end();
  redis.quit();
  process.exit(0);
});

// Run if executed directly
if (require.main === module) {
  startDataProcessingScheduler();
}
