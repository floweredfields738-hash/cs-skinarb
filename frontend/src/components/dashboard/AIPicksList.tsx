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
  predicted7d?: number;
  volumeChange?: number;
  priceVsAvg?: number;
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

          return (
            <div
              key={pick.skinId + '-' + idx}
              className={`glass-panel-subtle p-4 group hover:${config.border} transition-all duration-300 cursor-pointer`}
            >
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
                <ArrowUpRight className="w-3 h-3 text-gray-600 group-hover:text-gold-400/50 transition-colors" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AIPicksList;
