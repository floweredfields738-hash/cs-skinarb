import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Package,
  Trophy,
  Plus,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  BarChart3,
  PieChart,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import { useLiveSkinsList, useLivePriceFeed, useConnectionStatus } from '../hooks/useRealTimeData';

// Seeded random for deterministic portfolio generation per skin id
function seededRandom(seed: number) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

const RARITY_COLORS: Record<string, { color: string; bgColor: string }> = {
  Covert: { color: 'text-red-400', bgColor: 'bg-red-500' },
  Classified: { color: 'text-pink-400', bgColor: 'bg-pink-500' },
  Restricted: { color: 'text-purple-400', bgColor: 'bg-purple-500' },
  'Mil-Spec': { color: 'text-blue-400', bgColor: 'bg-blue-500' },
  'Mil-Spec Grade': { color: 'text-blue-400', bgColor: 'bg-blue-500' },
  Industrial: { color: 'text-cyan-400', bgColor: 'bg-cyan-500' },
  'Industrial Grade': { color: 'text-cyan-400', bgColor: 'bg-cyan-500' },
  Consumer: { color: 'text-gray-400', bgColor: 'bg-gray-500' },
  'Consumer Grade': { color: 'text-gray-400', bgColor: 'bg-gray-500' },
};

function getRarityStyle(rarity: string) {
  return RARITY_COLORS[rarity] || RARITY_COLORS['Mil-Spec'];
}

const Portfolio: React.FC = () => {
  const [timeRange, setTimeRange] = useState<string>('30D');
  const [sortBy, setSortBy] = useState<string>('allocation');
  const [secondsAgo, setSecondsAgo] = useState(0);
  const lastUpdateRef = useRef(Date.now());

  const { skins, loading: skinsLoading } = useLiveSkinsList();
  const priceFeed = useLivePriceFeed(30);
  const connected = useConnectionStatus();

  // Reset timer when skins update
  useEffect(() => {
    if (skins.length > 0) {
      lastUpdateRef.current = Date.now();
      setSecondsAgo(0);
    }
  }, [skins]);

  // Tick the timer
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdateRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Build portfolio holdings from first 8 skins
  const holdings = useMemo(() => {
    const subset = skins.slice(0, 8);
    return subset.map((skin: any, idx: number) => {
      const currentPrice = parseFloat(skin.current_price) || (10 + idx * 20);
      const seed = skin.id ? (typeof skin.id === 'number' ? skin.id : parseInt(skin.id, 10) || idx + 1) : idx + 1;
      const quantity = Math.floor(seededRandom(seed) * 5) + 1;
      const purchaseRatio = 0.90 + seededRandom(seed + 100) * 0.08; // 90-98%
      const avgPurchasePrice = currentPrice * purchaseRatio;
      const plAmount = (currentPrice - avgPurchasePrice) * quantity;
      const plPercent = avgPurchasePrice > 0 ? ((currentPrice - avgPurchasePrice) / avgPurchasePrice) * 100 : 0;
      const change24h = parseFloat(skin.change_24h) || 0;
      const trend = change24h >= 0 ? 'up' : 'down';

      // Generate price history based on current price
      const history: number[] = [];
      let val = avgPurchasePrice;
      const step = (currentPrice - avgPurchasePrice) / 8;
      for (let i = 0; i < 9; i++) {
        val = avgPurchasePrice + step * i + (seededRandom(seed + i * 7) - 0.5) * currentPrice * 0.02;
        history.push(val);
      }
      history[history.length - 1] = currentPrice;

      return {
        id: skin.id || idx + 1,
        skin: skin.name || `${skin.weapon_name || 'Unknown'} | ${skin.skin_name || 'Skin'}`,
        rarity: skin.rarity || 'Mil-Spec',
        quantity,
        avgPurchasePrice,
        currentPrice,
        plAmount,
        plPercent,
        allocation: 0, // computed below
        trend,
        priceHistory: history,
        _flash: skin._flash || false,
      };
    });
  }, [skins]);

  // Compute allocations
  const holdingsWithAlloc = useMemo(() => {
    const totalVal = holdings.reduce((s: number, h: any) => s + h.currentPrice * h.quantity, 0);
    return holdings.map((h: any) => ({
      ...h,
      allocation: totalVal > 0 ? ((h.currentPrice * h.quantity) / totalVal) * 100 : 0,
    }));
  }, [holdings]);

  const totalValue = useMemo(
    () => holdingsWithAlloc.reduce((s: number, h: any) => s + h.currentPrice * h.quantity, 0),
    [holdingsWithAlloc]
  );
  const totalCost = useMemo(
    () => holdingsWithAlloc.reduce((s: number, h: any) => s + h.avgPurchasePrice * h.quantity, 0),
    [holdingsWithAlloc]
  );
  const totalPL = totalValue - totalCost;
  const totalPLPercent = totalCost > 0 ? ((totalPL / totalCost) * 100).toFixed(1) : '0.0';
  const totalItems = holdingsWithAlloc.reduce((s: number, h: any) => s + h.quantity, 0);
  const bestPerformer = holdingsWithAlloc.length > 0
    ? holdingsWithAlloc.reduce((best: any, h: any) => (h.plPercent > best.plPercent ? h : best), holdingsWithAlloc[0])
    : null;
  const isPLPositive = totalPL >= 0;

  // Build performance chart from live price feed
  const performanceData = useMemo(() => {
    if (priceFeed.length > 1) {
      // Use price feed data to build a chart
      const prices = priceFeed.map((p: any) => parseFloat(p.newPrice) || 0).reverse();
      // Pad to 30 points if needed
      while (prices.length < 30) {
        prices.unshift(prices[0] || totalValue);
      }
      return prices.slice(0, 30);
    }
    // Fallback: generate from total value with slight variation
    const base = totalValue || 3000;
    const data: number[] = [];
    let val = base * 0.92;
    for (let i = 0; i < 30; i++) {
      val += (base * 0.08) / 30 + (Math.sin(i * 0.5) * base * 0.005);
      data.push(val);
    }
    data[data.length - 1] = base;
    return data;
  }, [priceFeed, totalValue]);

  const chartMax = Math.max(...performanceData);
  const chartMin = Math.min(...performanceData);
  const chartRange = chartMax - chartMin || 1;

  const chartPath = performanceData
    .map((val: number, i: number) => {
      const x = (i / (performanceData.length - 1)) * 100;
      const y = 100 - ((val - chartMin) / chartRange) * 80 - 10;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
  const chartArea = chartPath + ' L 100 100 L 0 100 Z';

  // Diversification from rarity distribution
  const rarityBreakdown = useMemo(() => {
    const rarities: Record<string, { count: number; value: number }> = {};
    holdingsWithAlloc.forEach((h: any) => {
      const r = h.rarity || 'Mil-Spec';
      if (!rarities[r]) rarities[r] = { count: 0, value: 0 };
      rarities[r].count += h.quantity;
      rarities[r].value += h.currentPrice * h.quantity;
    });

    const totalVal = Object.values(rarities).reduce((s, r) => s + r.value, 0);
    const allRarities = ['Covert', 'Classified', 'Restricted', 'Mil-Spec', 'Industrial', 'Consumer'];

    return allRarities.map((name) => {
      const data = rarities[name] || { count: 0, value: 0 };
      const style = getRarityStyle(name);
      return {
        name,
        count: data.count,
        value: data.value,
        percentage: totalVal > 0 ? (data.value / totalVal) * 100 : 0,
        color: style.color,
        bgColor: style.bgColor,
      };
    });
  }, [holdingsWithAlloc]);

  const sortedHoldings = useMemo(() => {
    const sorted = [...holdingsWithAlloc];
    switch (sortBy) {
      case 'allocation': return sorted.sort((a: any, b: any) => b.allocation - a.allocation);
      case 'pl': return sorted.sort((a: any, b: any) => b.plPercent - a.plPercent);
      case 'value': return sorted.sort((a: any, b: any) => (b.currentPrice * b.quantity) - (a.currentPrice * a.quantity));
      case 'name': return sorted.sort((a: any, b: any) => a.skin.localeCompare(b.skin));
      default: return sorted;
    }
  }, [sortBy, holdingsWithAlloc]);

  // Mini sparkline helper
  const renderSparkline = (data: number[], positive: boolean) => {
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const path = data
      .map((v: number, i: number) => {
        const x = (i / (data.length - 1)) * 40;
        const y = 16 - ((v - min) / range) * 14 - 1;
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
    return (
      <svg width="40" height="16" viewBox="0 0 40 16" className="inline-block">
        <path
          d={path}
          fill="none"
          stroke={positive ? '#34d399' : '#f87171'}
          strokeWidth="1.5"
        />
      </svg>
    );
  };

  // Loading skeleton
  if (skinsLoading && skins.length === 0) {
    return (
      <div className="space-y-6 max-w-[1600px] mx-auto fade-in">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Portfolio</h1>
            <p className="text-sm text-gray-500 mt-1">Inventory valuation and performance tracking</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-panel-hover p-5">
              <div className="h-3 w-24 rounded bg-white/[0.04] animate-pulse mb-3" />
              <div className="h-7 w-32 rounded bg-white/[0.06] animate-pulse mb-2" />
              <div className="h-4 w-16 rounded bg-white/[0.04] animate-pulse" />
            </div>
          ))}
        </div>
        <div className="glass-panel p-6">
          <div className="h-52 rounded-xl bg-carbon-900/50 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto fade-in">
      {/* Flash animation */}
      <style>{`
        @keyframes portfolioFlash {
          0% { background-color: rgba(0, 229, 255, 0.10); }
          100% { background-color: transparent; }
        }
        .portfolio-flash-row {
          animation: portfolioFlash 1s ease-out forwards;
        }
      `}</style>

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Portfolio</h1>
          <p className="text-sm text-gray-500 mt-1">Inventory valuation and performance tracking</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-carbon-800/60 border border-white/[0.06] text-gray-300 text-[12px] font-semibold hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-200">
            <Download className="w-3.5 h-3.5" />
            Import from Steam
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-glow/[0.1] text-cyan-glow text-[12px] font-semibold hover:bg-cyan-glow/[0.18] border border-cyan-glow/20 hover:border-cyan-glow/40 transition-all duration-200 hover:shadow-glow-cyan">
            <Plus className="w-3.5 h-3.5" />
            Add Item
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Value */}
        <div className="glass-panel-hover p-5 group">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Total Value</p>
              <h3 className="text-2xl font-bold text-white mt-2 font-mono tracking-tight">
                ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <div className="flex items-center gap-1.5 mt-2">
                <div className="px-1.5 py-0.5 rounded text-[11px] font-bold font-mono bg-cyan-glow/10 text-cyan-glow">
                  LIVE
                </div>
                <span className="text-[10px] text-gray-600">real-time</span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-cyan-glow/[0.06] text-cyan-glow/60 group-hover:bg-cyan-glow/10 group-hover:text-cyan-glow transition-all duration-300">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Total P/L */}
        <div className="glass-panel-hover p-5 group">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Total Profit / Loss</p>
              <h3 className={`text-2xl font-bold mt-2 font-mono tracking-tight ${isPLPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                {isPLPositive ? '+' : ''}${totalPL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <div className="flex items-center gap-1.5 mt-2">
                <div className={`px-1.5 py-0.5 rounded text-[11px] font-bold font-mono ${isPLPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                  {isPLPositive ? '\u25b2' : '\u25bc'} {totalPLPercent}%
                </div>
                <span className="text-[10px] text-gray-600">all time</span>
              </div>
            </div>
            <div className={`p-2.5 rounded-xl transition-all duration-300 ${isPLPositive ? 'bg-emerald-500/[0.06] text-emerald-400/60 group-hover:bg-emerald-500/10 group-hover:text-emerald-400' : 'bg-red-500/[0.06] text-red-400/60 group-hover:bg-red-500/10 group-hover:text-red-400'}`}>
              {isPLPositive ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            </div>
          </div>
        </div>

        {/* Total Items */}
        <div className="glass-panel-hover p-5 group">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Total Items</p>
              <h3 className="text-2xl font-bold text-white mt-2 font-mono tracking-tight">{totalItems}</h3>
              <div className="flex items-center gap-1.5 mt-2">
                <div className="px-1.5 py-0.5 rounded text-[11px] font-bold font-mono bg-cyan-glow/10 text-cyan-glow">
                  {holdingsWithAlloc.length} unique
                </div>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-cyan-glow/[0.06] text-cyan-glow/60 group-hover:bg-cyan-glow/10 group-hover:text-cyan-glow transition-all duration-300">
              <Package className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Best Performer */}
        <div className="glass-panel-hover p-5 group">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Best Performer</p>
              <h3 className="text-lg font-bold text-white mt-2 tracking-tight leading-tight">
                {bestPerformer ? bestPerformer.skin.split('|')[0].trim() : '--'}
              </h3>
              <div className="flex items-center gap-1.5 mt-2">
                <div className="px-1.5 py-0.5 rounded text-[11px] font-bold font-mono bg-emerald-500/10 text-emerald-400">
                  {bestPerformer ? `\u25b2 +${bestPerformer.plPercent.toFixed(1)}%` : '--'}
                </div>
                <span className="text-[10px] text-gray-600">ROI</span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-gold-500/[0.08] text-gold-400/60 group-hover:bg-gold-500/[0.12] group-hover:text-gold-400 transition-all duration-300">
              <Trophy className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Performance Chart + Diversification */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Performance Chart */}
        <div className="lg:col-span-2 glass-panel p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-glow/[0.08]">
                <BarChart3 className="w-4 h-4 text-cyan-glow" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Portfolio Performance</h2>
                <p className="text-[11px] text-gray-500 font-mono mt-0.5">Total value over time</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold font-mono text-white">
                ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
              <div className={`flex items-center gap-0.5 px-2 py-1 rounded-lg ${isPLPositive ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                {isPLPositive
                  ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                  : <ArrowDownRight className="w-3.5 h-3.5 text-red-400" />
                }
                <span className={`text-xs font-bold font-mono ${isPLPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isPLPositive ? '+' : ''}{totalPLPercent}%
                </span>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="relative h-52 rounded-xl bg-carbon-900/50 border border-white/[0.03] overflow-hidden p-4">
            {/* Grid lines */}
            <div className="absolute inset-4">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="absolute w-full flex items-center" style={{ top: `${i * 25}%` }}>
                  <div className="w-full border-t border-white/[0.03]"></div>
                  <span className="text-[9px] text-gray-700 font-mono ml-2 whitespace-nowrap">
                    ${(chartMax - (chartRange * i) / 4).toFixed(0)}
                  </span>
                </div>
              ))}
            </div>

            {/* SVG Chart */}
            <svg
              viewBox="0 0 100 100"
              className="absolute inset-4 w-[calc(100%-2rem)] h-[calc(100%-2rem)]"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(0, 229, 255, 0.18)" />
                  <stop offset="50%" stopColor="rgba(0, 229, 255, 0.06)" />
                  <stop offset="100%" stopColor="rgba(0, 229, 255, 0)" />
                </linearGradient>
                <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#06b6d4" />
                  <stop offset="100%" stopColor="#00e5ff" />
                </linearGradient>
              </defs>
              <path d={chartArea} fill="url(#portfolioGradient)" />
              <path
                d={chartPath}
                fill="none"
                stroke="url(#lineGradient)"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            {/* Current value dot */}
            <div className="absolute right-4 top-4 flex items-center gap-1.5">
              <div className="neon-dot" style={{ width: '6px', height: '6px' }}></div>
            </div>
          </div>

          {/* Time range selector */}
          <div className="flex items-center gap-1 mt-4">
            {['7D', '30D', '90D', '6M', '1Y', 'ALL'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold font-mono transition-all duration-200 ${
                  timeRange === range
                    ? 'bg-cyan-glow/10 text-cyan-glow border border-cyan-glow/20'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        {/* Diversification */}
        <div className="glass-panel p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-gold-500/[0.08]">
              <PieChart className="w-4 h-4 text-gold-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Diversification</h2>
              <p className="text-[11px] text-gray-500 font-mono mt-0.5">By rarity tier</p>
            </div>
          </div>

          <div className="space-y-4">
            {rarityBreakdown.map((rarity) => (
              <div key={rarity.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${rarity.bgColor}`}></div>
                    <span className={`text-[12px] font-medium ${rarity.color}`}>{rarity.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-gray-500 font-mono">{rarity.count} items</span>
                    <span className="text-[11px] text-white font-mono font-semibold w-12 text-right">
                      {rarity.percentage > 0 ? `${rarity.percentage.toFixed(1)}%` : '--'}
                    </span>
                  </div>
                </div>
                <div className="w-full h-2 rounded-full bg-carbon-700/60 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${rarity.bgColor} transition-all duration-500`}
                    style={{
                      width: `${rarity.percentage}%`,
                      opacity: rarity.percentage > 0 ? 0.7 : 0,
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="mt-6 pt-5 border-t border-white/[0.04]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Risk Score</span>
              <span className="text-[13px] text-gold-400 font-mono font-bold">
                {rarityBreakdown[0].percentage > 50 ? 'High' : rarityBreakdown[0].percentage > 30 ? 'Medium' : 'Low'}
              </span>
            </div>
            <p className="text-[11px] text-gray-600 leading-relaxed">
              {rarityBreakdown[0].percentage > 50
                ? 'Heavy concentration in Covert tier. Consider diversifying into lower-rarity items for stability.'
                : 'Portfolio is reasonably diversified across rarity tiers.'}
            </p>
          </div>
        </div>
      </div>

      {/* Holdings Table */}
      <div className="glass-panel overflow-hidden">
        <div className="px-6 py-5 border-b border-white/[0.04] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-glow/[0.08]">
              <Package className="w-4 h-4 text-cyan-glow" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Holdings</h2>
              <p className="text-[11px] text-gray-500 font-mono mt-0.5">{totalItems} items across {holdingsWithAlloc.length} skins</p>
            </div>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Sort by</span>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="appearance-none px-3 py-2 pr-8 rounded-xl bg-carbon-900/60 border border-white/[0.06] text-[12px] text-gray-300 focus:outline-none focus:border-cyan-glow/30 transition-all duration-200 font-mono cursor-pointer"
              >
                <option value="allocation" className="bg-carbon-800">Allocation</option>
                <option value="pl" className="bg-carbon-800">P/L %</option>
                <option value="value" className="bg-carbon-800">Value</option>
                <option value="name" className="bg-carbon-800">Name</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left py-4 px-6 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Skin</th>
                <th className="text-center py-4 px-4 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Qty</th>
                <th className="text-right py-4 px-4 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Avg Cost</th>
                <th className="text-right py-4 px-4 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Current</th>
                <th className="text-right py-4 px-4 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Trend</th>
                <th className="text-right py-4 px-4 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">P/L</th>
                <th className="text-right py-4 px-4 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">P/L %</th>
                <th className="text-right py-4 px-6 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Alloc</th>
              </tr>
            </thead>
            <tbody>
              {sortedHoldings.map((h: any) => {
                const isPos = h.plAmount >= 0;
                return (
                  <tr
                    key={h.id}
                    className={`border-b border-white/[0.03] hover:bg-white/[0.02] transition-all duration-200 cursor-pointer group ${h._flash ? 'portfolio-flash-row' : ''}`}
                  >
                    {/* Skin */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="text-white font-medium text-[13px] group-hover:text-cyan-glow/90 transition-colors">
                            {h.skin.includes('(') ? h.skin.split('(')[0].trim() : h.skin}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-gray-600 font-mono">
                              {h.skin.match(/\(([^)]+)\)/)?.[1] || ''}
                            </span>
                            <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                              h.rarity === 'Covert' ? 'text-red-400/80 bg-red-500/10' :
                              h.rarity === 'Classified' ? 'text-pink-400/80 bg-pink-500/10' :
                              h.rarity === 'Restricted' ? 'text-purple-400/80 bg-purple-500/10' :
                              'text-blue-400/80 bg-blue-500/10'
                            }`}>
                              {h.rarity}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Quantity */}
                    <td className="py-4 px-4 text-center">
                      <span className="text-white font-mono text-[13px]">{h.quantity}</span>
                    </td>

                    {/* Avg Cost */}
                    <td className="py-4 px-4 text-right">
                      <span className="text-gray-400 font-mono text-[13px]">${h.avgPurchasePrice.toFixed(2)}</span>
                    </td>

                    {/* Current Price */}
                    <td className="py-4 px-4 text-right">
                      <span className="text-white font-mono text-[13px] font-semibold">
                        ${h.currentPrice.toFixed(2)}
                      </span>
                    </td>

                    {/* Sparkline */}
                    <td className="py-4 px-4 text-right">
                      {renderSparkline(h.priceHistory, h.trend === 'up')}
                    </td>

                    {/* P/L Amount */}
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isPos ? (
                          <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <ArrowDownRight className="w-3 h-3 text-red-400" />
                        )}
                        <span className={`font-bold font-mono text-[13px] ${isPos ? 'text-emerald-400' : 'text-red-400'}`}>
                          {isPos ? '+' : ''}${h.plAmount.toFixed(2)}
                        </span>
                      </div>
                    </td>

                    {/* P/L % */}
                    <td className="py-4 px-4 text-right">
                      <span
                        className={`inline-block px-2 py-1 rounded-lg text-[11px] font-bold font-mono ${
                          isPos ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                        }`}
                      >
                        {isPos ? '+' : ''}{h.plPercent.toFixed(1)}%
                      </span>
                    </td>

                    {/* Allocation */}
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-carbon-700 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-cyan-glow/40 to-cyan-glow/80"
                            style={{ width: `${h.allocation}%` }}
                          ></div>
                        </div>
                        <span className="text-gray-400 font-mono text-[12px] w-12 text-right">
                          {h.allocation.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.04] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-gray-600" />
              <span className="text-[11px] text-gray-600 font-mono">
                Prices updated {secondsAgo}s ago
                {connected && <span className="ml-2 text-cyan-glow/60">&bull; Live</span>}
              </span>
            </div>
          </div>
          <button className="flex items-center gap-1.5 text-[11px] text-cyan-glow/60 hover:text-cyan-glow font-medium transition-colors">
            Export portfolio <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Portfolio;
