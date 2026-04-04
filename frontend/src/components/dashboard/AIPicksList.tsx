import React, { useState, useEffect } from 'react';
import { Crosshair, TrendingUp, ArrowUpRight, ArrowRightLeft, BarChart3, ShoppingCart } from 'lucide-react';
import { aiPicksApi } from '../../api/services';
import AnimatedNumber from '../common/AnimatedNumber';

interface AIPick {
  skinId: number;
  name: string;
  rarity: string;
  category: 'undervalued' | 'trending_up' | 'arbitrage' | 'volume_spike';
  categoryLabel: string;
  currentPrice: number;
  aiScore: number;
  confidence: number;
  recommendation: string;
  reasons: string[];
  minFloat: number;
  maxFloat: number;
  arbitrageProfit?: number;
  arbitrageMarkets?: string;
  predicted7d?: number;
  volumeChange?: number;
  priceVsAvg?: number;
  markets?: { name: string; price: number; url: string }[];
  cheapestMarket?: string;
  cheapestPrice?: number;
  buyUrl?: string;
}

const CATEGORY_CONFIG = {
  undervalued: {
    icon: ShoppingCart,
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    border: 'border-emerald-400/20',
    glow: 'rgba(52, 211, 153, 0.3)',
    gradient: 'linear-gradient(90deg, rgba(52, 211, 153, 0.5), rgba(110, 231, 183, 0.9))',
    label: 'Undervalued',
  },
  trending_up: {
    icon: TrendingUp,
    color: 'text-cyan-400',
    bg: 'bg-cyan-400/10',
    border: 'border-cyan-400/20',
    glow: 'rgba(34, 211, 238, 0.3)',
    gradient: 'linear-gradient(90deg, rgba(34, 211, 238, 0.5), rgba(103, 232, 249, 0.9))',
    label: 'Trending Up',
  },
  arbitrage: {
    icon: ArrowRightLeft,
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    border: 'border-amber-400/20',
    glow: 'rgba(251, 191, 36, 0.3)',
    gradient: 'linear-gradient(90deg, rgba(245, 158, 11, 0.5), rgba(252, 211, 77, 0.9))',
    label: 'Arbitrage',
  },
  volume_spike: {
    icon: BarChart3,
    color: 'text-violet-400',
    bg: 'bg-violet-400/10',
    border: 'border-violet-400/20',
    glow: 'rgba(167, 139, 250, 0.3)',
    gradient: 'linear-gradient(90deg, rgba(139, 92, 246, 0.5), rgba(167, 139, 250, 0.9))',
    label: 'Volume Spike',
  },
};

const AIPicksList: React.FC = () => {
  const [picks, setPicks] = useState<AIPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchPicks = async () => {
      try {
        const res = await aiPicksApi.get();
        if (mounted && res.data?.data) {
          setPicks(res.data.data);
        }
      } catch {
        // silently fail — will retry
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchPicks();
    const interval = setInterval(fetchPicks, 30000); // refresh every 30s

    return () => { mounted = false; clearInterval(interval); };
  }, []);

  return (
    <div className="glass-panel p-6 h-full">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-glow/[0.08] border border-cyan-glow/10">
            <Crosshair className="w-4 h-4 text-cyan-glow" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">AI Picks</h2>
            <p className="text-[11px] text-gray-500 font-mono mt-0.5">Multi-Engine Analysis</p>
          </div>
        </div>
        <div className="neon-dot"></div>
      </div>

      <div className="space-y-3">
        {loading && picks.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-gray-500 text-xs font-mono">Analyzing market data...</p>
          </div>
        )}
        {!loading && picks.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-gray-500 text-xs font-mono">No picks available — waiting for market data</p>
          </div>
        )}
        {picks.map((pick, idx) => {
          const config = CATEGORY_CONFIG[pick.category] || CATEGORY_CONFIG.undervalued;
          const CategoryIcon = config.icon;

          const isExpanded = expandedId === pick.skinId;

          return (
            <div
              key={pick.skinId + '-' + idx}
              className={`glass-panel-subtle group transition-all duration-300 cursor-pointer ${isExpanded ? config.border + ' border' : ''}`}
              onClick={() => setExpandedId(isExpanded ? null : pick.skinId)}
            >
              <div className="p-4">
                {/* Header: name + category badge + score */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-semibold truncate group-hover:text-gold-300 transition-colors">
                      {pick.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-mono text-gray-400">
                        <AnimatedNumber value={pick.currentPrice} prefix="$" decimals={2} duration={600} />
                      </span>
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${config.bg} ${config.color}`}>
                        <CategoryIcon className="w-2.5 h-2.5" />
                        {config.label}
                      </span>
                    </div>
                  </div>
                  <div className="text-right ml-2">
                    <div className="text-lg font-bold font-mono text-gold-400">
                      <AnimatedNumber value={pick.aiScore} decimals={0} duration={600} />
                    </div>
                    <div className="text-[9px] text-gray-500 uppercase tracking-wider">
                      {pick.confidence >= 80 ? 'High' : pick.confidence >= 60 ? 'Med' : 'Low'}
                    </div>
                  </div>
                </div>

                {/* Reasoning tags */}
                <div className="flex flex-wrap gap-1 mb-2">
                  {pick.reasons.slice(0, 3).map((reason, i) => (
                    <span
                      key={i}
                      className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] text-gray-400 border border-white/[0.06]"
                    >
                      {reason}
                    </span>
                  ))}
                </div>

                {/* Score bar */}
                <div className="relative">
                  <div className="w-full bg-carbon-900/80 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(pick.aiScore, 100)}%`,
                        background: config.gradient,
                        boxShadow: `0 0 8px ${config.glow}`,
                      }}
                    ></div>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${config.color}`}>
                    {pick.recommendation}
                  </span>
                  <ArrowUpRight className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-90 text-gold-400' : 'text-gray-600 group-hover:text-gold-400/50'}`} />
                </div>
              </div>

              {/* ─── Expanded Detail Panel ─── */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-white/[0.04] pt-3 space-y-3" onClick={(e) => e.stopPropagation()}>

                  {/* Why this pick — plain English explanation */}
                  <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Why this pick</p>
                    <p className="text-[11px] text-gray-300 leading-relaxed">
                      {pick.category === 'undervalued' && pick.priceVsAvg
                        ? `This skin is currently trading ${Math.abs(pick.priceVsAvg).toFixed(0)}% below its 30-day average price. With ${pick.confidence >= 80 ? 'strong' : 'moderate'} trading volume, this suggests it's temporarily underpriced and likely to recover.`
                        : pick.category === 'trending_up' && pick.predicted7d
                        ? `Our prediction model estimates this skin will reach $${pick.predicted7d.toFixed(2)} within 7 days (+${((pick.predicted7d / pick.currentPrice - 1) * 100).toFixed(1)}%). The uptrend is supported by ${pick.reasons.length} converging signals.`
                        : pick.category === 'arbitrage' && pick.arbitrageProfit
                        ? `A $${pick.arbitrageProfit.toFixed(2)} profit opportunity exists right now. Buy on the cheaper market and sell on the more expensive one. This spread has been verified across live market data.`
                        : pick.category === 'volume_spike' && pick.volumeChange
                        ? `Trading volume surged ${pick.volumeChange.toFixed(0)}% above normal this week. Sudden volume spikes often precede price increases as demand outpaces supply.`
                        : `Multiple market signals converged to flag this skin. Score: ${pick.aiScore}/100 with ${pick.confidence}% confidence.`
                      }
                    </p>
                  </div>

                  {/* Confidence breakdown */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center p-2 rounded bg-white/[0.02]">
                      <p className="text-[9px] text-gray-500 mb-0.5">AI Score</p>
                      <p className={`text-sm font-bold font-mono ${pick.aiScore >= 80 ? 'text-emerald-400' : pick.aiScore >= 60 ? 'text-cyan-400' : 'text-gray-400'}`}>{pick.aiScore}/100</p>
                    </div>
                    <div className="text-center p-2 rounded bg-white/[0.02]">
                      <p className="text-[9px] text-gray-500 mb-0.5">Confidence</p>
                      <p className={`text-sm font-bold font-mono ${pick.confidence >= 80 ? 'text-emerald-400' : pick.confidence >= 60 ? 'text-amber-400' : 'text-red-400'}`}>{pick.confidence}%</p>
                    </div>
                    <div className="text-center p-2 rounded bg-white/[0.02]">
                      <p className="text-[9px] text-gray-500 mb-0.5">Signals</p>
                      <p className="text-sm font-bold font-mono text-cyan-400">{pick.reasons.length}</p>
                    </div>
                  </div>

                  {/* Market prices */}
                  {pick.markets && pick.markets.length > 0 && (
                    <div>
                      <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1.5">Market Prices (FN/MW/FT only)</p>
                      <div className="space-y-1">
                        {pick.markets.slice(0, 5).map((m, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <span className="text-[11px] text-gray-400 font-mono truncate flex-1">{m.name}</span>
                            <div className="flex items-center gap-2 ml-2">
                              <span className={`text-[11px] font-mono font-bold ${i === 0 ? 'text-emerald-400' : 'text-gray-300'}`}>
                                ${m.price.toFixed(2)}
                              </span>
                              <a
                                href={m.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-glow/10 text-cyan-glow hover:bg-cyan-glow/20 transition-colors"
                              >
                                {i === 0 ? 'BUY' : 'VIEW'}
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Arbitrage info */}
                  {pick.arbitrageMarkets && (
                    <div className="flex items-center gap-2 text-[10px] font-mono">
                      <span className="text-gray-500">Route:</span>
                      <span className="text-amber-400">{pick.arbitrageMarkets}</span>
                      {pick.arbitrageProfit && (
                        <span className="text-emerald-400 font-bold">+${pick.arbitrageProfit.toFixed(2)}</span>
                      )}
                    </div>
                  )}

                  {/* Prediction info */}
                  {pick.predicted7d && pick.predicted7d !== pick.currentPrice && (
                    <div className="flex items-center gap-2 text-[10px] font-mono">
                      <span className="text-gray-500">7d Prediction:</span>
                      <span className={pick.predicted7d > pick.currentPrice ? 'text-emerald-400' : 'text-red-400'}>
                        ${pick.predicted7d.toFixed(2)} ({pick.predicted7d > pick.currentPrice ? '+' : ''}{((pick.predicted7d / pick.currentPrice - 1) * 100).toFixed(1)}%)
                      </span>
                    </div>
                  )}

                  {/* Buy button */}
                  {pick.buyUrl && (
                    <a
                      href={pick.buyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full text-center py-2 mt-2 rounded text-xs font-bold uppercase tracking-wider bg-cyan-glow/10 text-cyan-glow border border-cyan-glow/20 hover:bg-cyan-glow/20 transition-colors"
                    >
                      Buy on {pick.cheapestMarket?.split(' (')[0] || 'Market'} — ${pick.cheapestPrice?.toFixed(2)}
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AIPicksList;
