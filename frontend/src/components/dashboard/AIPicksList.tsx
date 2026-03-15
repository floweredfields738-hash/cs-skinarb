import React from 'react';
import { Crosshair, TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useLiveSkinsList } from '../../hooks/useRealTimeData';
import AnimatedNumber from '../common/AnimatedNumber';

const mockPicks = [
  { name: 'AK-47 | Phantom Disruptor', score: 92, recommendation: 'Strong Buy', price: '$142.50', change: '+18.3%', confidence: 'High' },
  { name: 'M4A4 | Asiimov', score: 85, recommendation: 'Buy', price: '$89.90', change: '+12.1%', confidence: 'High' },
  { name: 'AWP | Dragon Lore', score: 78, recommendation: 'Buy', price: '$4,250', change: '+8.7%', confidence: 'Medium' },
  { name: 'Glock-18 | Fade', score: 74, recommendation: 'Hold', price: '$320.00', change: '+5.2%', confidence: 'Medium' },
];

function formatPrice(val: number | undefined) {
  if (!val) return '$0.00';
  return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatChange(val: number | undefined) {
  if (val === undefined || val === null) return '+0.0%';
  return (val >= 0 ? '+' : '') + val.toFixed(1) + '%';
}

function getRecommendation(score: number) {
  if (score >= 85) return 'Strong Buy';
  if (score >= 70) return 'Buy';
  if (score >= 50) return 'Hold';
  return 'Watch';
}

function getConfidence(score: number) {
  if (score >= 80) return 'High';
  if (score >= 60) return 'Medium';
  return 'Low';
}

const AIPicksList: React.FC = () => {
  const { skins } = useLiveSkinsList();

  // Sort by opportunity_score or overall_score, take top 5
  const livePicks = skins
    .filter((s: any) => s.opportunity_score || s.overall_score || s.current_price)
    .sort((a: any, b: any) => (b.opportunity_score || b.overall_score || 0) - (a.opportunity_score || a.overall_score || 0))
    .slice(0, 5)
    .map((s: any) => {
      const score = s.opportunity_score || s.overall_score || 50;
      return {
        name: s.name || s.skin_name || 'Unknown Skin',
        score,
        recommendation: getRecommendation(score),
        price: formatPrice(s.current_price),
        change: formatChange(s.change_24h),
        changeNum: s.change_24h || 0,
        confidence: getConfidence(score),
        _flash: s._flash,
      };
    });

  const picks = livePicks.length > 0 ? livePicks : mockPicks.map((p) => ({ ...p, changeNum: 0, _flash: false }));

  return (
    <div className="glass-panel p-6 h-full">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gold-400/[0.08]">
            <Crosshair className="w-4 h-4 text-gold-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">AI Picks</h2>
            <p className="text-[11px] text-gray-500 font-mono mt-0.5">ML-Powered Analysis</p>
          </div>
        </div>
        <div className="neon-dot-gold"></div>
      </div>

      <div className="space-y-3">
        {picks.map((pick, idx) => {
          const changePositive = typeof pick.changeNum === 'number' ? pick.changeNum >= 0 : !pick.change.startsWith('-');
          return (
            <div
              key={pick.name + '-' + idx}
              className={`glass-panel-subtle p-4 group hover:border-gold-500/20 transition-all duration-300 cursor-pointer ${
                pick._flash ? 'smooth-flash' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <p className="text-sm text-white font-semibold group-hover:text-gold-300 transition-colors">{pick.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-mono text-gray-400 live-value">
                      <AnimatedNumber value={parseFloat(pick.price.replace(/[$,]/g, ''))} prefix="$" decimals={2} duration={600} />
                    </span>
                    <span className={`text-[10px] font-bold font-mono flex items-center gap-0.5 ${
                      changePositive ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {changePositive
                        ? <ArrowUpRight className="w-2.5 h-2.5" />
                        : <ArrowDownRight className="w-2.5 h-2.5" />
                      }
                      {pick.change}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold font-mono text-gold-400 live-value">
                    <AnimatedNumber value={pick.score} decimals={0} duration={600} />
                  </div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider">{pick.confidence}</div>
                </div>
              </div>

              {/* Score bar */}
              <div className="relative">
                <div className="w-full bg-carbon-900/80 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full transition-all duration-500"
                    style={{
                      width: `${pick.score}%`,
                      background: `linear-gradient(90deg, rgba(245, 158, 11, 0.6), rgba(252, 211, 77, 0.9))`,
                      boxShadow: '0 0 8px rgba(245, 158, 11, 0.3)',
                    }}
                  ></div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gold-400/80">
                  {pick.recommendation}
                </span>
                <TrendingUp className="w-3 h-3 text-gray-600 group-hover:text-gold-400/50 transition-colors" />
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};

export default AIPicksList;
