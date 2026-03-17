import React from 'react';
import { DollarSign, Zap, BarChart3, Globe } from 'lucide-react';
import Card from '../components/dashboard/Card';
import MarketOverview from '../components/dashboard/MarketOverview';
import AIPicksList from '../components/dashboard/AIPicksList';
import ArbitrageGrid from '../components/dashboard/ArbitrageGrid';
import AnimatedNumber from '../components/common/AnimatedNumber';
import { useLiveMarketStats, useLivePriceFeed, useLiveArbitrage, useMarketIndex } from '../hooks/useRealTimeData';

function formatVolume(val: number) {
  if (val >= 1_000_000) return '$' + (val / 1_000_000).toFixed(1) + 'M';
  if (val >= 1_000) return '$' + (val / 1_000).toFixed(1) + 'K';
  return '$' + val.toFixed(0);
}

function formatChange(val: number) {
  const prefix = val >= 0 ? '+' : '';
  return prefix + val.toFixed(1) + '%';
}

const Dashboard: React.FC = () => {
  const stats = useLiveMarketStats();
  const feed = useLivePriceFeed(10);
  const { data: arbData } = useLiveArbitrage();

  const indexPoints = useMarketIndex();
  const latestIndex = indexPoints.length > 0 ? indexPoints[indexPoints.length - 1] : null;
  const firstIndex = indexPoints.length > 0 ? indexPoints[0] : null;
  const indexChange = latestIndex && firstIndex && firstIndex.totalValue > 0
    ? ((latestIndex.totalValue - firstIndex.totalValue) / firstIndex.totalValue) * 100
    : 0;
  const indexIsPositive = indexChange >= 0;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Real-time market analytics and trading intelligence</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="neon-dot"></div>
          <span className="text-[11px] text-gray-500 font-mono">
            {feed.length > 0 ? 'Live' : 'Connecting...'}
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        <Card
          title="Market Volume (24h)"
          value={stats.totalVolume24h ? formatVolume(stats.totalVolume24h) : '$0'}
          change={formatChange(stats.avgChange24h)}
          icon={<DollarSign className="w-5 h-5" />}
        />
        <Card
          title="Active Skins"
          value={stats.activeSkins ? stats.activeSkins.toLocaleString() : '0'}
          change=""
          icon={<BarChart3 className="w-5 h-5" />}
        />
        <Card
          title="Arbitrage Found"
          value={String(stats.arbitrageCount || arbData.length)}
          change=""
          icon={<Zap className="w-5 h-5" />}
        />
      </div>

      {/* All-Time Market Value */}
      <div className="glass-panel p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-cyan-glow/[0.08] border border-cyan-glow/10">
              <Globe className="w-5 h-5 text-cyan-glow" />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Total CS2 Market Value (USD)</p>
              <div className="flex items-baseline gap-3 mt-1">
                <span className="text-3xl font-bold font-mono text-white live-value">
                  {latestIndex && latestIndex.totalValue > 0
                    ? <AnimatedNumber value={latestIndex.totalValue} prefix="$" decimals={2} duration={500} className="text-3xl font-bold font-mono text-white" />
                    : <span className="text-gray-500">Calculating...</span>}
                </span>
                {latestIndex && latestIndex.totalValue > 0 && (
                  <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold font-mono ${
                    indexIsPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                  }`}>
                    {indexIsPositive ? '▲' : '▼'} {indexIsPositive ? '+' : ''}{indexChange.toFixed(2)}% session
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-6 text-[10px] font-mono">
            {latestIndex && (
              <div className="flex items-center gap-1.5">
                <span className="text-gray-600 uppercase">Skins</span>
                <span className="text-gray-400">{latestIndex.skinCount}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <span className="text-gray-600 uppercase">Markets</span>
              <span className="text-gray-400">4</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="neon-dot" style={{ width: '4px', height: '4px' }}></div>
              <span className="text-cyan-glow/60">Real-time</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          <MarketOverview />
          <ArbitrageGrid />
        </div>

        {/* Right Column */}
        <div>
          <AIPicksList />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
