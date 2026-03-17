import React, { useEffect, useState } from 'react';
import { ExternalLink, TrendingUp, TrendingDown, ArrowRight, RefreshCw } from 'lucide-react';
import { marketApi } from '../../api/services';
import AnimatedNumber from '../common/AnimatedNumber';

interface MarketPrice {
  market_id: number;
  market_name: string;
  price: number;
  volume: number;
  float_value: number | null;
  custom_name: string | null;
  direct_url: string | null;
  last_updated: string;
}

interface ExteriorComparison {
  exterior: string;
  markets: MarketPrice[];
  cheapest: MarketPrice;
  mostExpensive: MarketPrice | null;
  spread: number;
  spreadPercent: number;
  marketCount: number;
}

interface ComparisonData {
  skin: {
    id: number;
    name: string;
    rarity: string;
    min_float: string;
    max_float: string;
  };
  comparisons: ExteriorComparison[];
  totalMarkets: number;
  totalListings: number;
}

const MARKET_COLORS: Record<string, string> = {
  'Steam Community Market': '#4a90d9',
  'Skinport': '#9b59b6',
  'CSFloat': '#2ecc71',
  'Buff163': '#f5a623',
};

const EXTERIOR_ORDER = ['Factory New', 'Minimal Wear', 'Field-Tested', 'Well-Worn', 'Battle-Scarred'];

interface Props {
  skinId: number;
  skinName?: string;
}

const CrossMarketComparison: React.FC<Props> = ({ skinId }) => {
  const [data, setData] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedExterior, setSelectedExterior] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    marketApi.compareSkin(String(skinId))
      .then(res => {
        const d = res.data;
        if (d.success) {
          setData(d);
          // Auto-select first exterior with multiple markets
          const multiMarket = d.comparisons.find((c: ExteriorComparison) => c.marketCount >= 2);
          setSelectedExterior(multiMarket?.exterior || d.comparisons[0]?.exterior || null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [skinId]);

  if (loading) {
    return (
      <div className="glass-panel p-6">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-5 h-5 text-cyan-glow/40 animate-spin" />
          <span className="text-sm text-gray-500 ml-3 font-mono">Loading cross-market data...</span>
        </div>
      </div>
    );
  }

  if (!data || data.comparisons.length === 0) {
    return (
      <div className="glass-panel p-6">
        <p className="text-sm text-gray-500 text-center py-4">No cross-market data available for this skin</p>
      </div>
    );
  }

  // Sort exteriors in standard order
  const sortedComparisons = [...data.comparisons].sort((a, b) => {
    const ai = EXTERIOR_ORDER.indexOf(a.exterior);
    const bi = EXTERIOR_ORDER.indexOf(b.exterior);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const activeComparison = sortedComparisons.find(c => c.exterior === selectedExterior) || sortedComparisons[0];

  return (
    <div className="glass-panel p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base font-bold text-white">Cross-Market Prices</h3>
          <p className="text-[11px] text-gray-500 font-mono mt-0.5">
            {data.totalListings} listings across {data.totalMarkets} markets
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-600 font-mono">
            Float {Number(data.skin.min_float).toFixed(2)}–{Number(data.skin.max_float).toFixed(2)}
          </span>
        </div>
      </div>

      {/* Exterior tabs */}
      <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1">
        {sortedComparisons.map(comp => {
          const isActive = comp.exterior === selectedExterior;
          const hasArbitrage = comp.marketCount >= 2 && comp.spreadPercent > 5;
          return (
            <button
              key={comp.exterior}
              onClick={() => setSelectedExterior(comp.exterior)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-cyan-glow/15 text-cyan-glow border border-cyan-glow/30'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04] border border-transparent'
              }`}
            >
              {comp.exterior}
              {hasArbitrage && (
                <span className="ml-1.5 text-[8px] text-emerald-400">●</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Price comparison table */}
      {activeComparison && (
        <div className="space-y-3">
          {/* Spread indicator */}
          {activeComparison.marketCount >= 2 && activeComparison.mostExpensive && (
            <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${
              activeComparison.spreadPercent > 10
                ? 'bg-emerald-500/[0.06] border-emerald-500/20'
                : 'bg-white/[0.02] border-white/[0.06]'
            }`}>
              <div className="flex items-center gap-2">
                {activeComparison.spreadPercent > 10 ? (
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-gray-500" />
                )}
                <span className="text-[12px] font-mono text-gray-300">
                  Price spread:
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[13px] font-bold font-mono text-white">
                  ${activeComparison.spread.toFixed(2)}
                </span>
                <span className={`text-[12px] font-bold font-mono ${
                  activeComparison.spreadPercent > 10 ? 'text-emerald-400' : 'text-gray-500'
                }`}>
                  {activeComparison.spreadPercent.toFixed(1)}%
                </span>
              </div>
            </div>
          )}

          {/* Market rows */}
          {activeComparison.markets
            .sort((a, b) => a.price - b.price)
            .map((market, idx) => {
              const isCheapest = idx === 0 && activeComparison.markets.length > 1;
              const isMostExpensive = idx === activeComparison.markets.length - 1 && activeComparison.markets.length > 1;
              const color = MARKET_COLORS[market.market_name] || '#6b7280';

              return (
                <div
                  key={`${market.market_id}-${market.price}`}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                    isCheapest
                      ? 'bg-emerald-500/[0.04] border-emerald-500/15'
                      : 'bg-white/[0.02] border-white/[0.05]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}40` }}
                    />
                    <div>
                      <span className="text-[13px] font-medium text-white">{market.market_name}</span>
                      {market.float_value && (
                        <span className="text-[10px] text-gray-500 font-mono ml-2">
                          Float {market.float_value.toFixed(6)}
                        </span>
                      )}
                      {market.custom_name && (
                        <span className="text-[10px] text-gold-400 font-mono ml-2">
                          "{market.custom_name}"
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <AnimatedNumber
                        value={market.price}
                        prefix="$"
                        decimals={2}
                        duration={500}
                        className="text-[14px] font-bold font-mono text-white"
                      />
                      {market.volume > 0 && (
                        <p className="text-[9px] text-gray-600 font-mono">{market.volume} listed</p>
                      )}
                    </div>

                    {isCheapest && (
                      <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                        Best Buy
                      </span>
                    )}
                    {isMostExpensive && (
                      <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-cyan-500/15 text-cyan-400 border border-cyan-500/20">
                        Best Sell
                      </span>
                    )}

                    {market.direct_url && (
                      <a
                        href={market.direct_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg text-gray-600 hover:text-cyan-glow hover:bg-cyan-glow/10 transition-all"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}

          {/* Arbitrage hint */}
          {activeComparison.marketCount >= 2 && activeComparison.spreadPercent > 5 && activeComparison.mostExpensive && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gold-400/[0.04] border border-gold-400/10">
              <ArrowRight className="w-3.5 h-3.5 text-gold-400" />
              <span className="text-[11px] text-gold-400/80 font-mono">
                Buy on {activeComparison.cheapest.market_name} at ${activeComparison.cheapest.price.toFixed(2)}
                {' → '}Sell on {activeComparison.mostExpensive.market_name} at ${activeComparison.mostExpensive.price.toFixed(2)}
                {' = '}${activeComparison.spread.toFixed(2)} profit
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CrossMarketComparison;
