import React, { useEffect, useState } from 'react';
import { Zap, ArrowRight, ExternalLink, ChevronDown } from 'lucide-react';
import { useLiveArbitrage } from '../../hooks/useRealTimeData';
import AnimatedNumber from '../common/AnimatedNumber';

const DEFAULT_ROWS = 5;

function getRiskColor(risk: string | undefined) {
  const r = (risk || '').toLowerCase();
  if (r === 'low') return 'text-emerald-400/80 bg-emerald-500/10';
  if (r === 'high') return 'text-red-400/80 bg-red-500/10';
  return 'text-gold-400/80 bg-gold-500/10';
}

function getRiskLabel(risk: string | undefined) {
  if (!risk) return 'Med';
  return risk.charAt(0).toUpperCase() + risk.slice(1).toLowerCase();
}

const exteriorAbbrevMap: Record<string, string> = {
  'Factory New': 'FN',
  'Minimal Wear': 'MW',
  'Field-Tested': 'FT',
  'Well-Worn': 'WW',
  'Battle-Scarred': 'BS',
};

const exteriorBadgeColors: Record<string, string> = {
  'FN': 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  'MW': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  'FT': 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  'WW': 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  'BS': 'text-red-400 bg-red-500/10 border-red-500/20',
};

function getExteriorBadge(exterior: string | null | undefined) {
  if (!exterior) return null;
  const abbr = exteriorAbbrevMap[exterior] || exterior;
  const style = exteriorBadgeColors[abbr] || 'text-gray-400 bg-white/[0.06] border-white/[0.08]';
  return (
    <span className={`inline-flex items-center text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ml-2 ${style}`}>
      {abbr}
    </span>
  );
}

const SkeletonRow: React.FC = () => (
  <tr className="border-b border-white/[0.03]">
    <td className="py-3.5"><div className="h-4 w-40 bg-white/[0.06] rounded animate-pulse"></div></td>
    <td className="py-3.5"><div className="h-4 w-56 bg-white/[0.06] rounded animate-pulse"></div></td>
    <td className="py-3.5 text-right"><div className="h-4 w-14 bg-white/[0.06] rounded animate-pulse ml-auto"></div></td>
    <td className="py-3.5 text-right"><div className="h-4 w-10 bg-white/[0.06] rounded animate-pulse ml-auto"></div></td>
  </tr>
);

const ArbitrageGrid: React.FC = () => {
  const { data, loading } = useLiveArbitrage();
  const [flashedIds, setFlashedIds] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  // Clear flash flags after animation
  useEffect(() => {
    const flashingRows = data.filter((o: any) => o._flash);
    if (flashingRows.length === 0) return;
    const ids = flashingRows.map((o: any) => `${o.skin_name}-${o.source_market}-${o.target_market}`);
    setFlashedIds((prev) => new Set([...prev, ...ids]));
    const timer = setTimeout(() => {
      setFlashedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id: string) => next.delete(id));
        return next;
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [data]);

  const opportunities = data;

  return (
    <div className="glass-panel p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-glow/[0.08]">
            <Zap className="w-4 h-4 text-cyan-glow" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Active Arbitrage</h2>
            <p className="text-[11px] text-gray-500 font-mono mt-0.5">
              {loading ? 'Loading...' : `${opportunities.length} Opportunities Found`}
            </p>
          </div>
        </div>
        <button className="text-[11px] text-cyan-glow/60 hover:text-cyan-glow font-medium transition-colors flex items-center gap-1">
          View All <ExternalLink className="w-3 h-3" />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="text-left py-3 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Skin</th>
              <th className="text-left py-3 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Route</th>
              <th className="text-right py-3 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">ROI</th>
              <th className="text-right py-3 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Risk</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            ) : opportunities.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full bg-cyan-glow/60"
                      style={{ animation: 'pulse 1.5s ease-in-out infinite' }}
                    ></span>
                    <span className="text-sm text-gray-500 font-mono">Scanning for opportunities...</span>
                  </div>
                </td>
              </tr>
            ) : (
              opportunities.slice(0, showAll ? undefined : DEFAULT_ROWS).map((opp: any, idx: number) => {
                const rowId = `${opp.skin_name}-${opp.source_market}-${opp.target_market}`;
                const isFlashing = opp._flash || flashedIds.has(rowId);
                return (
                  <tr
                    key={rowId + '-' + idx}
                    className={`border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors cursor-pointer group ${
                      isFlashing ? 'smooth-flash' : ''
                    }`}
                  >
                    <td className="py-3.5">
                      <p className="text-white font-medium text-[13px] group-hover:text-cyan-glow/90 transition-colors flex items-center">
                        {opp.skin_name}
                        {getExteriorBadge(opp.exterior)}
                      </p>
                    </td>
                    <td className="py-3.5">
                      <div className="flex items-center gap-2 text-[12px] font-mono">
                        <span className="text-gray-400">{opp.source_market}</span>
                        <span className="text-gray-500 text-[10px] price-cell">
                          <AnimatedNumber value={typeof opp.buy_price === 'string' ? parseFloat(opp.buy_price) : (opp.buy_price || 0)} prefix="$" decimals={2} duration={600} />
                        </span>
                        <ArrowRight className="w-3 h-3 text-cyan-glow/40" />
                        <span className="text-gray-300">{opp.target_market}</span>
                        <span className="text-gray-500 text-[10px] price-cell">
                          <AnimatedNumber value={typeof opp.sell_price === 'string' ? parseFloat(opp.sell_price) : (opp.sell_price || 0)} prefix="$" decimals={2} duration={600} />
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 text-right">
                      <span className="text-emerald-400 font-bold font-mono text-[13px] price-cell">
                        <AnimatedNumber value={typeof opp.roi === 'string' ? parseFloat(opp.roi) : (opp.roi || 0)} prefix="+" suffix="%" decimals={1} duration={600} />
                      </span>
                    </td>
                    <td className="py-3.5 text-right">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded ${getRiskColor(opp.risk_level)}`}>
                        {getRiskLabel(opp.risk_level)}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {opportunities.length > DEFAULT_ROWS && (
        <div className="flex justify-center pt-4 border-t border-white/[0.04] mt-1">
          <button
            onClick={() => setShowAll(prev => !prev)}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-white/[0.03] text-cyan-glow text-[10px] font-bold uppercase tracking-wider hover:bg-cyan-glow/10 border border-cyan-glow/15 hover:border-cyan-glow/30 transition-all duration-200 font-mono"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showAll ? 'rotate-180' : ''}`} />
            {showAll ? 'Show Less' : `Show More (${opportunities.length - DEFAULT_ROWS} more)`}
          </button>
        </div>
      )}

    </div>
  );
};

export default ArbitrageGrid;
