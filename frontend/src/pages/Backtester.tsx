import React, { useState, useEffect } from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';

interface BacktestResult {
  period: string;
  totalOpportunities: number;
  avgProfit: number;
  totalProfit: number;
  avgRoi: number;
  bestTrade: { name: string; profit: number; roi: number } | null;
  worstTrade: { name: string; profit: number; roi: number } | null;
  winRate: number;
  avgHoldTime: string;
}

const Backtester: React.FC = () => {
  const [period, setPeriod] = useState('7d');
  const [minProfit, setMinProfit] = useState('5');
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);

  const runBacktest = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const h: Record<string, string> = {};
      if (token) h['Authorization'] = `Bearer ${token}`;

      // Fetch historical arbitrage data
      const res = await fetch(`/api/arbitrage?limit=500`, { headers: h });
      const data = await res.json();

      if (!data.success || !data.data?.length) {
        setResult(null);
        setLoading(false);
        return;
      }

      const minP = parseFloat(minProfit) || 0;
      const now = Date.now();
      const periodMs = period === '24h' ? 86400000 : period === '7d' ? 604800000 : period === '30d' ? 2592000000 : Infinity;
      const opps = data.data.filter((o: any) => {
        if (parseFloat(o.net_profit) < minP) return false;
        if (periodMs < Infinity && o.created_at) {
          const age = now - new Date(o.created_at).getTime();
          if (age > periodMs) return false;
        }
        return true;
      });

      if (opps.length === 0) {
        setResult(null);
        setLoading(false);
        return;
      }

      const profits = opps.map((o: any) => parseFloat(o.net_profit));
      const rois = opps.map((o: any) => parseFloat(o.roi));
      const totalProfit = profits.reduce((s: number, p: number) => s + p, 0);
      const avgProfit = totalProfit / profits.length;
      const avgRoi = rois.reduce((s: number, r: number) => s + r, 0) / rois.length;

      const sorted = [...opps].sort((a: any, b: any) => parseFloat(b.net_profit) - parseFloat(a.net_profit));
      const best = sorted[0];
      const worst = sorted[sorted.length - 1];

      setResult({
        period,
        totalOpportunities: opps.length,
        avgProfit: Math.round(avgProfit * 100) / 100,
        totalProfit: Math.round(totalProfit * 100) / 100,
        avgRoi: Math.round(avgRoi * 100) / 100,
        bestTrade: best ? { name: best.name || best.skin_name, profit: parseFloat(best.net_profit), roi: parseFloat(best.roi) } : null,
        worstTrade: worst ? { name: worst.name || worst.skin_name, profit: parseFloat(worst.net_profit), roi: parseFloat(worst.roi) } : null,
        winRate: 100, // All opportunities shown are profitable by definition
        avgHoldTime: '~15-60 min (market dependent)',
      });
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { runBacktest(); }, []);

  return (
    <div className="space-y-6 fade-in ">

      {/* Controls */}
      <div className="glass-panel p-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-2">Period</label>
            <div className="flex gap-2">
              {['24h', '7d', '30d', 'all'].map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    period === p ? 'bg-cyan-glow/10 text-cyan-glow border border-cyan-glow/20' : 'text-gray-500 border border-transparent'
                  }`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-2">Min Profit ($)</label>
            <input type="number" value={minProfit} onChange={e => setMinProfit(e.target.value)}
              className="w-24 px-3 py-2 rounded-lg bg-carbon-800/80 border border-white/[0.06] text-white text-sm font-mono focus:outline-none focus:border-cyan-glow/30" />
          </div>
          <button onClick={runBacktest} disabled={loading}
            className="flex items-center gap-2 px-5 py-2 rounded-lg font-bold text-sm bg-gradient-to-r from-cyan-600 to-cyan-glow text-carbon-950 hover:shadow-glow-cyan transition-all disabled:opacity-40">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Run Simulation
          </button>
        </div>
      </div>

      {/* Results */}
      {result ? (
        <>
          {/* Big number */}
          <div className="glass-panel p-8 text-center border-l-4 border-emerald-500/40">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-2">If you'd acted on every opportunity</p>
            <p className="text-5xl font-bold text-emerald-400 font-mono">
              +${result.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className="text-gray-500 text-sm mt-2">from {result.totalOpportunities} opportunities</p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="glass-panel p-4">
              <p className="text-[9px] text-gray-500 uppercase tracking-widest font-mono mb-1">Opportunities</p>
              <p className="text-xl font-bold text-white">{result.totalOpportunities}</p>
            </div>
            <div className="glass-panel p-4">
              <p className="text-[9px] text-gray-500 uppercase tracking-widest font-mono mb-1">Avg Profit</p>
              <p className="text-xl font-bold text-emerald-400 font-mono">${result.avgProfit.toFixed(2)}</p>
            </div>
            <div className="glass-panel p-4">
              <p className="text-[9px] text-gray-500 uppercase tracking-widest font-mono mb-1">Avg ROI</p>
              <p className="text-xl font-bold text-cyan-glow font-mono">{result.avgRoi.toFixed(1)}%</p>
            </div>
            <div className="glass-panel p-4">
              <p className="text-[9px] text-gray-500 uppercase tracking-widest font-mono mb-1">Est. Hold Time</p>
              <p className="text-sm font-bold text-white">{result.avgHoldTime}</p>
            </div>
          </div>

          {/* Best/Worst */}
          <div className="grid grid-cols-2 gap-4">
            {result.bestTrade && (
              <div className="glass-panel p-5 border-l-2 border-emerald-500/30">
                <p className="text-[9px] text-gray-500 uppercase tracking-widest font-mono mb-2">Best Opportunity</p>
                <p className="text-sm text-white font-medium">{result.bestTrade.name}</p>
                <p className="text-lg font-bold text-emerald-400 font-mono mt-1">+${result.bestTrade.profit.toFixed(2)} ({result.bestTrade.roi.toFixed(1)}%)</p>
              </div>
            )}
            {result.worstTrade && (
              <div className="glass-panel p-5 border-l-2 border-yellow-500/30">
                <p className="text-[9px] text-gray-500 uppercase tracking-widest font-mono mb-2">Smallest Profit</p>
                <p className="text-sm text-white font-medium">{result.worstTrade.name}</p>
                <p className="text-lg font-bold text-yellow-400 font-mono mt-1">+${result.worstTrade.profit.toFixed(2)} ({result.worstTrade.roi.toFixed(1)}%)</p>
              </div>
            )}
          </div>

          {/* Disclaimer */}
          <div className="glass-panel p-4 border-l-2 border-gray-700">
            <p className="text-[11px] text-gray-500">
              This simulation assumes you acted on every opportunity instantly and prices didn't change between detection and execution. Real results vary based on execution speed, market liquidity, and price slippage. Past opportunities do not guarantee future results.
            </p>
          </div>
        </>
      ) : !loading ? (
        <div className="glass-panel p-10 text-center">
          <BarChart3 className="w-8 h-8 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No opportunities found for this period. Try adjusting filters.</p>
        </div>
      ) : null}
    </div>
  );
};

export default Backtester;
