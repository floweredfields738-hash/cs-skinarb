import { query, queryOne, queryMany } from '../utils/database';
import { logger } from '../utils/logging';
import { SkinSeed, SKIN_CATALOG } from './skinCatalog';

const SKINS: SkinSeed[] = SKIN_CATALOG; // 252 skins from full catalog

const _OLD_SKINS: SkinSeed[] = [
  // AK-47s
  {
    name: 'AK-47 | Neon Rider', weapon_name: 'AK-47', skin_name: 'Neon Rider',
    rarity: 'Covert', case_name: 'Danger Zone Case', min_float: 0.0, max_float: 0.7,
    is_knife: false, has_souvenir: false, release_date: '2018-12-06', base_price: 42.50,
  },
  {
    name: 'AK-47 | Phantom Disruptor', weapon_name: 'AK-47', skin_name: 'Phantom Disruptor',
    rarity: 'Covert', case_name: 'Fracture Case', min_float: 0.0, max_float: 1.0,
    is_knife: false, has_souvenir: false, release_date: '2020-08-06', base_price: 18.75,
  },
  {
    name: 'AK-47 | Redline', weapon_name: 'AK-47', skin_name: 'Redline',
    rarity: 'Classified', case_name: 'Phoenix Weapon Case', min_float: 0.1, max_float: 0.7,
    is_knife: false, has_souvenir: false, release_date: '2014-02-20', base_price: 14.30,
  },
  // M4A4 / M4A1-S
  {
    name: 'M4A4 | Asiimov', weapon_name: 'M4A4', skin_name: 'Asiimov',
    rarity: 'Covert', case_name: 'Winter Offensive Weapon Case', min_float: 0.18, max_float: 1.0,
    is_knife: false, has_souvenir: false, release_date: '2013-12-18', base_price: 55.00,
  },
  {
    name: 'M4A4 | Neo-Noir', weapon_name: 'M4A4', skin_name: 'Neo-Noir',
    rarity: 'Covert', case_name: 'Prisma Case', min_float: 0.0, max_float: 0.7,
    is_knife: false, has_souvenir: false, release_date: '2019-03-13', base_price: 12.80,
  },
  {
    name: 'M4A1-S | Printstream', weapon_name: 'M4A1-S', skin_name: 'Printstream',
    rarity: 'Covert', case_name: 'Dreams & Nightmares Case', min_float: 0.0, max_float: 1.0,
    is_knife: false, has_souvenir: false, release_date: '2022-01-20', base_price: 125.00,
  },
  // AWPs
  {
    name: 'AWP | Dragon Lore', weapon_name: 'AWP', skin_name: 'Dragon Lore',
    rarity: 'Covert', case_name: 'Cobblestone Collection', min_float: 0.0, max_float: 0.7,
    is_knife: false, has_souvenir: true, release_date: '2014-07-01', base_price: 5200.00,
  },
  {
    name: 'AWP | Fade', weapon_name: 'AWP', skin_name: 'Fade',
    rarity: 'Covert', case_name: 'Anubis Collection', min_float: 0.0, max_float: 0.08,
    is_knife: false, has_souvenir: false, release_date: '2023-03-22', base_price: 890.00,
  },
  {
    name: 'AWP | Asiimov', weapon_name: 'AWP', skin_name: 'Asiimov',
    rarity: 'Covert', case_name: 'Operation Phoenix Weapon Case', min_float: 0.18, max_float: 1.0,
    is_knife: false, has_souvenir: false, release_date: '2014-02-20', base_price: 32.00,
  },
  // Desert Eagle
  {
    name: 'Desert Eagle | Blaze', weapon_name: 'Desert Eagle', skin_name: 'Blaze',
    rarity: 'Restricted', case_name: 'Dust Collection', min_float: 0.0, max_float: 0.08,
    is_knife: false, has_souvenir: false, release_date: '2013-08-14', base_price: 310.00,
  },
  {
    name: 'Desert Eagle | Code Red', weapon_name: 'Desert Eagle', skin_name: 'Code Red',
    rarity: 'Covert', case_name: 'Prisma 2 Case', min_float: 0.0, max_float: 0.7,
    is_knife: false, has_souvenir: false, release_date: '2020-04-21', base_price: 38.50,
  },
  // USP-S
  {
    name: 'USP-S | Kill Confirmed', weapon_name: 'USP-S', skin_name: 'Kill Confirmed',
    rarity: 'Covert', case_name: 'Shattered Web Case', min_float: 0.0, max_float: 1.0,
    is_knife: false, has_souvenir: false, release_date: '2019-11-18', base_price: 48.00,
  },
  {
    name: 'USP-S | Neo-Noir', weapon_name: 'USP-S', skin_name: 'Neo-Noir',
    rarity: 'Classified', case_name: 'Prisma Case', min_float: 0.0, max_float: 0.7,
    is_knife: false, has_souvenir: false, release_date: '2019-03-13', base_price: 5.20,
  },
  // Glock-18
  {
    name: 'Glock-18 | Fade', weapon_name: 'Glock-18', skin_name: 'Fade',
    rarity: 'Restricted', case_name: 'Assault Collection', min_float: 0.0, max_float: 0.08,
    is_knife: false, has_souvenir: false, release_date: '2013-08-14', base_price: 1450.00,
  },
  {
    name: 'Glock-18 | Gamma Doppler', weapon_name: 'Glock-18', skin_name: 'Gamma Doppler',
    rarity: 'Covert', case_name: 'Revolution Case', min_float: 0.0, max_float: 0.08,
    is_knife: false, has_souvenir: false, release_date: '2023-02-09', base_price: 220.00,
  },
  // Knives
  {
    name: 'Karambit | Doppler', weapon_name: 'Karambit', skin_name: 'Doppler',
    rarity: 'Extraordinary', case_name: 'Chroma Case', min_float: 0.0, max_float: 0.08,
    is_knife: true, has_souvenir: false, release_date: '2015-01-08', base_price: 780.00,
  },
  {
    name: 'Butterfly Knife | Fade', weapon_name: 'Butterfly Knife', skin_name: 'Fade',
    rarity: 'Extraordinary', case_name: 'Operation Breakout Weapon Case', min_float: 0.0, max_float: 0.08,
    is_knife: true, has_souvenir: false, release_date: '2014-07-01', base_price: 1850.00,
  },
  {
    name: 'M9 Bayonet | Crimson Web', weapon_name: 'M9 Bayonet', skin_name: 'Crimson Web',
    rarity: 'Extraordinary', case_name: 'CS:GO Weapon Case', min_float: 0.06, max_float: 0.8,
    is_knife: true, has_souvenir: false, release_date: '2013-08-14', base_price: 620.00,
  },
  // More rifles
  {
    name: 'AK-47 | Vulcan', weapon_name: 'AK-47', skin_name: 'Vulcan',
    rarity: 'Covert', case_name: 'Operation Vanguard Weapon Case', min_float: 0.0, max_float: 1.0,
    is_knife: false, has_souvenir: false, release_date: '2014-11-11', base_price: 28.00,
  },
  {
    name: 'AK-47 | The Empress', weapon_name: 'AK-47', skin_name: 'The Empress',
    rarity: 'Covert', case_name: 'Spectrum 2 Case', min_float: 0.0, max_float: 1.0,
    is_knife: false, has_souvenir: false, release_date: '2017-09-15', base_price: 22.50,
  },
  {
    name: 'M4A1-S | Hyper Beast', weapon_name: 'M4A1-S', skin_name: 'Hyper Beast',
    rarity: 'Covert', case_name: 'Falchion Case', min_float: 0.0, max_float: 1.0,
    is_knife: false, has_souvenir: false, release_date: '2015-05-26', base_price: 16.00,
  },
  // SMGs and others
  {
    name: 'P2000 | Ocean Foam', weapon_name: 'P2000', skin_name: 'Ocean Foam',
    rarity: 'Classified', case_name: 'CS:GO Weapon Case', min_float: 0.0, max_float: 0.08,
    is_knife: false, has_souvenir: false, release_date: '2013-08-14', base_price: 185.00,
  },
  {
    name: 'Five-SeveN | Monkey Business', weapon_name: 'Five-SeveN', skin_name: 'Monkey Business',
    rarity: 'Classified', case_name: 'Falchion Case', min_float: 0.0, max_float: 0.92,
    is_knife: false, has_souvenir: false, release_date: '2015-05-26', base_price: 3.80,
  },
  {
    name: 'SSG 08 | Dragonfire', weapon_name: 'SSG 08', skin_name: 'Dragonfire',
    rarity: 'Classified', case_name: 'Gamma Case', min_float: 0.0, max_float: 0.7,
    is_knife: false, has_souvenir: false, release_date: '2016-06-15', base_price: 8.50,
  },
  {
    name: 'Bayonet | Tiger Tooth', weapon_name: 'Bayonet', skin_name: 'Tiger Tooth',
    rarity: 'Extraordinary', case_name: 'Chroma 2 Case', min_float: 0.0, max_float: 0.08,
    is_knife: true, has_souvenir: false, release_date: '2015-04-15', base_price: 350.00,
  },
];

const MARKET_IDS = { steam: 1, buff163: 2, skinport: 3, csfloat: 4 };
const MARKET_NAMES = ['steam', 'buff163', 'skinport', 'csfloat'];

// Steam is most expensive, Buff163 cheapest, others in between
function generateMarketPrice(basePrice: number, marketName: string): { price: number; volume: number } {
  let multiplier: number;
  let volumeBase: number;

  switch (marketName) {
    case 'steam':
      multiplier = 1.0 + Math.random() * 0.08; // 100-108% of base
      volumeBase = 200 + Math.floor(Math.random() * 800);
      break;
    case 'buff163':
      multiplier = 0.82 + Math.random() * 0.06; // 82-88% of base (cheapest)
      volumeBase = 500 + Math.floor(Math.random() * 2000);
      break;
    case 'skinport':
      multiplier = 0.90 + Math.random() * 0.06; // 90-96% of base
      volumeBase = 100 + Math.floor(Math.random() * 500);
      break;
    case 'csfloat':
      multiplier = 0.88 + Math.random() * 0.06; // 88-94% of base
      volumeBase = 150 + Math.floor(Math.random() * 600);
      break;
    default:
      multiplier = 1.0;
      volumeBase = 100;
  }

  return {
    price: Math.round(basePrice * multiplier * 100) / 100,
    volume: volumeBase,
  };
}

function generatePriceStats(basePrice: number): {
  avg7d: number; avg30d: number;
  min7d: number; max7d: number;
  min30d: number; max30d: number;
  volatility: number;
  vol7d: number; vol30d: number;
} {
  const volatility = Math.round((5 + Math.random() * 40) * 100) / 100;
  const factor7d = volatility / 100;
  const factor30d = factor7d * 1.8;

  return {
    avg7d: Math.round(basePrice * (0.97 + Math.random() * 0.06) * 100) / 100,
    avg30d: Math.round(basePrice * (0.94 + Math.random() * 0.12) * 100) / 100,
    min7d: Math.round(basePrice * (1 - factor7d * 0.5) * 100) / 100,
    max7d: Math.round(basePrice * (1 + factor7d * 0.6) * 100) / 100,
    min30d: Math.round(basePrice * (1 - factor30d * 0.5) * 100) / 100,
    max30d: Math.round(basePrice * (1 + factor30d * 0.6) * 100) / 100,
    volatility,
    vol7d: 500 + Math.floor(Math.random() * 5000),
    vol30d: 2000 + Math.floor(Math.random() * 20000),
  };
}

function generateOpportunityScore(): {
  overall: number; undervaluation: number; volumeTrend: number;
  rarityWeight: number; casePopularity: number; floatRarity: number;
  recommendation: string;
} {
  const overall = Math.round((40 + Math.random() * 55) * 100) / 100;
  const recommendation =
    overall >= 85 ? 'strong_buy' :
    overall >= 70 ? 'buy' :
    overall >= 55 ? 'neutral' :
    overall >= 45 ? 'sell' : 'avoid';

  return {
    overall,
    undervaluation: Math.round((30 + Math.random() * 65) * 100) / 100,
    volumeTrend: Math.round((20 + Math.random() * 75) * 100) / 100,
    rarityWeight: Math.round((40 + Math.random() * 55) * 100) / 100,
    casePopularity: Math.round((25 + Math.random() * 70) * 100) / 100,
    floatRarity: Math.round((15 + Math.random() * 80) * 100) / 100,
    recommendation,
  };
}

async function seedMarkets(): Promise<void> {
  const existing = await queryOne('SELECT COUNT(*) as count FROM markets');
  if (existing && parseInt(existing.count) >= 4) {
    logger.info('Markets already seeded, skipping...');
    return;
  }

  // Markets are inserted by schema.sql, but ensure they exist
  const markets = [
    { name: 'steam', display_name: 'Steam Community Market', fee: 13 },
    { name: 'buff163', display_name: 'Buff163', fee: 5 },
    { name: 'skinport', display_name: 'Skinport', fee: 10 },
    { name: 'csfloat', display_name: 'CSFloat', fee: 3 },
  ];

  for (const m of markets) {
    await query(
      `INSERT INTO markets (name, display_name, fee_percentage)
       VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING`,
      [m.name, m.display_name, m.fee]
    );
  }
}

async function seedSkins(): Promise<void> {
  for (const skin of SKINS) {
    await query(
      `INSERT INTO skins (name, weapon_name, skin_name, rarity, case_name, min_float, max_float, is_knife, is_glove, has_souvenir, release_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (name) DO NOTHING`,
      [skin.name, skin.weapon_name, skin.skin_name, skin.rarity, skin.case_name,
       skin.min_float, skin.max_float, skin.is_knife, skin.is_glove || false, skin.has_souvenir, skin.release_date]
    );
  }
}

async function seedMarketPrices(): Promise<void> {
  // When USE_REAL_DATA is enabled, don't seed fake prices — let the real APIs populate them
  if (process.env.USE_REAL_DATA === 'true') {
    logger.info('  Real data mode: skipping fake market price seeding (APIs will populate real prices)');
    return;
  }

  const skins = await queryMany('SELECT id, name FROM skins ORDER BY id');

  for (const skin of skins) {
    const seedSkin = SKINS.find(s => s.name === skin.name);
    if (!seedSkin) continue;

    for (const marketName of MARKET_NAMES) {
      const marketId = MARKET_IDS[marketName as keyof typeof MARKET_IDS];
      const { price, volume } = generateMarketPrice(seedSkin.base_price, marketName);

      await query(
        `INSERT INTO market_prices (skin_id, market_id, price, volume, last_updated)
         VALUES ($1, $2, $3, $4, NOW())`,
        [skin.id, marketId, price, volume]
      );
    }
  }
}

async function seedPriceStatistics(): Promise<void> {
  const skins = await queryMany('SELECT id, name FROM skins ORDER BY id');

  for (const skin of skins) {
    const seedSkin = SKINS.find(s => s.name === skin.name);
    if (!seedSkin) continue;

    const stats = generatePriceStats(seedSkin.base_price);

    await query(
      `INSERT INTO price_statistics (skin_id, avg_price_7d, avg_price_30d, min_price_7d, max_price_7d,
         min_price_30d, max_price_30d, price_volatility, trading_volume_7d, trading_volume_30d)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (skin_id) DO UPDATE SET
         avg_price_7d = EXCLUDED.avg_price_7d, avg_price_30d = EXCLUDED.avg_price_30d,
         min_price_7d = EXCLUDED.min_price_7d, max_price_7d = EXCLUDED.max_price_7d,
         min_price_30d = EXCLUDED.min_price_30d, max_price_30d = EXCLUDED.max_price_30d,
         price_volatility = EXCLUDED.price_volatility, trading_volume_7d = EXCLUDED.trading_volume_7d,
         trading_volume_30d = EXCLUDED.trading_volume_30d, updated_at = NOW()`,
      [skin.id, stats.avg7d, stats.avg30d, stats.min7d, stats.max7d,
       stats.min30d, stats.max30d, stats.volatility, stats.vol7d, stats.vol30d]
    );
  }
}

async function seedOpportunityScores(): Promise<void> {
  const skins = await queryMany('SELECT id FROM skins ORDER BY id');

  for (const skin of skins) {
    const score = generateOpportunityScore();

    await query(
      `INSERT INTO opportunity_scores (skin_id, overall_score, undervaluation_score, volume_trend_score,
         rarity_weight_score, case_popularity_score, float_rarity_score, recommendation, calculated_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW() + INTERVAL '24 hours')`,
      [skin.id, score.overall, score.undervaluation, score.volumeTrend,
       score.rarityWeight, score.casePopularity, score.floatRarity, score.recommendation]
    );
  }
}

async function seedArbitrageOpportunities(): Promise<void> {
  // Find the skins with the biggest cross-market price differences
  const prices = await queryMany(
    `SELECT mp.skin_id, s.name as skin_name, mp.market_id, m.name as market_name, mp.price
     FROM market_prices mp
     JOIN skins s ON s.id = mp.skin_id
     JOIN markets m ON m.id = mp.market_id
     ORDER BY mp.skin_id, mp.price ASC`
  );

  // Group by skin
  const skinPrices = new Map<number, Array<{ market_id: number; market_name: string; price: number; skin_name: string }>>();
  for (const p of prices) {
    if (!skinPrices.has(p.skin_id)) {
      skinPrices.set(p.skin_id, []);
    }
    skinPrices.get(p.skin_id)!.push({
      market_id: p.market_id,
      market_name: p.market_name,
      price: parseFloat(p.price),
      skin_name: p.skin_name,
    });
  }

  // Calculate arbitrage for each skin and pick best ones
  interface ArbOpp {
    skinId: number;
    sourceMarketId: number;
    targetMarketId: number;
    buyPrice: number;
    sellPrice: number;
    grossProfit: number;
    feeCost: number;
    netProfit: number;
    profitMargin: number;
    roi: number;
  }

  const opportunities: ArbOpp[] = [];

  for (const [skinId, marketPrices] of skinPrices.entries()) {
    // cheapest buy vs most expensive sell
    const sorted = [...marketPrices].sort((a, b) => a.price - b.price);
    const cheapest = sorted[0];
    const expensive = sorted[sorted.length - 1];

    const grossProfit = expensive.price - cheapest.price;
    // Estimate fee: source market buy fee + target market sell fee
    const feeCost = Math.round(cheapest.price * 0.05 * 100) / 100; // ~5% combined fees
    const netProfit = Math.round((grossProfit - feeCost) * 100) / 100;
    const roi = Math.round((netProfit / cheapest.price) * 100 * 100) / 100;

    if (netProfit > 0) {
      opportunities.push({
        skinId,
        sourceMarketId: cheapest.market_id,
        targetMarketId: expensive.market_id,
        buyPrice: cheapest.price,
        sellPrice: expensive.price,
        grossProfit: Math.round(grossProfit * 100) / 100,
        feeCost,
        netProfit,
        profitMargin: Math.round((netProfit / expensive.price) * 100 * 100) / 100,
        roi,
      });
    }
  }

  // Sort by ROI descending and take top 10
  opportunities.sort((a, b) => b.roi - a.roi);
  const top = opportunities.slice(0, 10);

  for (const opp of top) {
    const riskLevel = opp.roi > 10 ? 'low' : opp.roi > 5 ? 'medium' : 'high';
    const liquidityScore = Math.round((50 + Math.random() * 45) * 100) / 100;

    await query(
      `INSERT INTO arbitrage_opportunities
         (skin_id, source_market_id, target_market_id, buy_price, sell_price,
          gross_profit, fee_cost, net_profit, profit_margin, roi,
          liquidity_score, risk_level, is_active, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, TRUE, NOW() + INTERVAL '6 hours')`,
      [opp.skinId, opp.sourceMarketId, opp.targetMarketId, opp.buyPrice, opp.sellPrice,
       opp.grossProfit, opp.feeCost, opp.netProfit, opp.profitMargin, opp.roi,
       liquidityScore, riskLevel]
    );
  }
}

export async function seedDatabase(): Promise<void> {
  try {
    // Check if skins already exist
    const existing = await queryOne('SELECT COUNT(*) as count FROM skins');
    if (existing && parseInt(existing.count) > 0) {
      logger.info(`Database already has ${existing.count} skins, skipping seed.`);
      return;
    }

    logger.info('Seeding database with CS2 skin data...');

    await seedMarkets();
    logger.info('  Markets seeded.');

    await seedSkins();
    logger.info(`  ${SKINS.length} skins seeded.`);

    if (process.env.USE_REAL_DATA === 'true') {
      logger.info('  REAL DATA mode — skipping fake prices/stats/scores. APIs will populate real data.');
    } else {
      await seedMarketPrices();
      logger.info('  Market prices seeded across 4 markets.');

      await seedPriceStatistics();
      logger.info('  Price statistics seeded.');

      await seedOpportunityScores();
      logger.info('  Opportunity scores seeded.');

      await seedArbitrageOpportunities();
      logger.info('  Arbitrage opportunities seeded.');
    }

    logger.info('Database seeding complete.');
  } catch (error) {
    logger.error('Failed to seed database:', error);
    throw error;
  }
}
