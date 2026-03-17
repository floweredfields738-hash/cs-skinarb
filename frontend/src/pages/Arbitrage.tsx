import React, { useState, useMemo, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Link } from 'react-router-dom';
import {
  Zap,
  TrendingUp,
  DollarSign,
  BarChart3,
  ArrowRight,
  Filter,
  Clock,
  ShieldCheck,
  AlertTriangle,
  ShieldAlert,
  ChevronDown,
  Search,
  ExternalLink,
  ShoppingCart,
  Download,
} from 'lucide-react';
import { useLiveArbitrage, useLiveMarketStats, useConnectionStatus } from '../hooks/useRealTimeData';
import { exportArbitrage } from '../utils/csvExport';

type RiskLevel = 'All' | 'Low' | 'Medium' | 'High';
type ExteriorFilter = 'All Conditions' | 'Factory New' | 'Minimal Wear' | 'Field-Tested' | 'Well-Worn' | 'Battle-Scarred';

const exteriorOptions: ExteriorFilter[] = ['All Conditions', 'Factory New', 'Minimal Wear', 'Field-Tested', 'Well-Worn', 'Battle-Scarred'];

const exteriorAbbrev: Record<string, string> = {
  'Factory New': 'FN',
  'Minimal Wear': 'MW',
  'Field-Tested': 'FT',
  'Well-Worn': 'WW',
  'Battle-Scarred': 'BS',
};

const exteriorBadgeStyle: Record<string, string> = {
  'FN': 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  'MW': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  'FT': 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  'WW': 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  'BS': 'text-red-400 bg-red-500/10 border-red-500/20',
};

function getExteriorBadge(exterior: string | null | undefined) {
  if (!exterior) return null;
  const abbr = exteriorAbbrev[exterior] || exterior;
  const style = exteriorBadgeStyle[abbr] || 'text-gray-400 bg-white/[0.06] border-white/[0.08]';
  return (
    <span className={`inline-flex items-center text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ml-2 ${style}`}>
      {abbr}
    </span>
  );
}

// Market pairs are built dynamically from actual arbitrage data (see filteredOpportunities)

// ─── Generate URLs that filter to the EXACT skin + exterior ────
function getMarketUrl(marketName: string, skinName: string, exterior: string): string {
  const m = (marketName || '').toLowerCase();
  const baseName = skinName.replace(/\s*\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)\s*/i, '').trim();
  const fullName = exterior ? `${baseName} (${exterior})` : baseName;

  // Parse "AK-47 | Green Laminate" into weapon + skin parts
  if (m.includes('steam')) {
    return `https://steamcommunity.com/market/listings/730/${encodeURIComponent(fullName)}`;
  }
  if (m.includes('skinport')) {
    // Build slug: "AK-47 | Orbit Mk01 (Factory New)" → "ak-47-orbit-mk01-factory-new"
    const slug = fullName
      .replace(/\s*\|\s*/g, '-')
      .replace(/[()]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-');
    return `https://skinport.com/item/cs2/${slug}`;
  }
  if (m.includes('buff')) return `https://buff.163.com/market/csgo#tab=selling&page_num=1&search=${encodeURIComponent(baseName)}`;
  if (m.includes('csfloat') || m.includes('float')) return `https://csfloat.com/search?sort_by=lowest_price&market_hash_name=${encodeURIComponent(fullName)}`;

  return `https://www.google.com/search?q=${encodeURIComponent(fullName + ' buy ' + marketName)}`;
}

function openTrade(opp: any) {
  const exterior = opp.exterior || '';
  const buyUrl = opp.buy_link || getMarketUrl(opp.source_market, opp.name || opp.skin_name, exterior);
  const sellUrl = opp.sell_link || getMarketUrl(opp.target_market, opp.name || opp.skin_name, exterior);

  // Open buy link first
  window.open(buyUrl, '_blank', 'noopener,noreferrer');
  // Small delay to avoid popup blocker on second tab
  setTimeout(() => {
    window.open(sellUrl, '_blank', 'noopener,noreferrer');
  }, 500);
}

// For showing links without opening (in case popups are blocked)
function getBuyUrl(opp: any): string {
  return opp.buy_link || getMarketUrl(opp.source_market, opp.name || opp.skin_name, opp.exterior || '');
}
function getSellUrl(opp: any): string {
  return opp.sell_link || getMarketUrl(opp.target_market, opp.name || opp.skin_name, opp.exterior || '');
}

const Arbitrage: React.FC = () => {
  const [riskFilter, setRiskFilter] = useState<RiskLevel>('All');
  const [exteriorFilter, setExteriorFilter] = useState<ExteriorFilter>('All Conditions');
  const [minRoi, setMinRoi] = useState<number>(0);
  const [marketPair, setMarketPair] = useState<string>('All Pairs');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAll, setShowAll] = useState<boolean>(false);
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const DEFAULT_ROW_COUNT = 10;
  const lastUpdateRef = useRef(Date.now());

  const { data: liveData, loading, bestOpp, lastRefresh } = useLiveArbitrage();
  const marketStats = useLiveMarketStats();
  const connected = useConnectionStatus();
  const [countdown, setCountdown] = useState(10);

  // Reset countdown when data refreshes
  useEffect(() => {
    setCountdown(10);
    lastUpdateRef.current = Date.now();
  }, [lastRefresh]);

  // Tick countdown + seconds ago every second
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastUpdateRef.current) / 1000);
      setCountdown(Math.max(0, 10 - elapsed));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Clear _flash after 1s
  useEffect(() => {
    const flashItems = liveData.filter((o: any) => o._flash);
    if (flashItems.length === 0) return;
    const timeout = setTimeout(() => {
      // We don't mutate state here - the flash class is applied via the current state
      // and the next WS update will set _flash again if needed
    }, 1000);
    return () => clearTimeout(timeout);
  }, [liveData]);

  const filteredOpportunities = useMemo(() => {
    return liveData.filter((opp: any) => {
      const risk = (opp.risk_level || 'Low') as string;
      if (riskFilter !== 'All' && risk !== riskFilter) return false;
      if (exteriorFilter !== 'All Conditions' && opp.exterior !== exteriorFilter) return false;
      const roi = parseFloat(opp.roi) || 0;
      if (roi < minRoi) return false;
      if (marketPair !== 'All Pairs') {
        const pair = `${opp.source_market} \u2192 ${opp.target_market}`;
        if (pair !== marketPair) return false;
      }
      const buyPrice = parseFloat(opp.buy_price) || 0;
      if (minPrice && buyPrice < parseFloat(minPrice)) return false;
      if (maxPrice && buyPrice > parseFloat(maxPrice)) return false;
      const name = (opp.skin_name || '').toLowerCase();
      if (searchQuery && !name.includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [liveData, riskFilter, exteriorFilter, minRoi, marketPair, searchQuery, minPrice, maxPrice]);

  // Build market pairs dynamically from actual data
  const marketPairs = useMemo(() => {
    const pairs = new Set<string>();
    liveData.forEach((o: any) => {
      if (o.source_market && o.target_market) {
        pairs.add(`${o.source_market} → ${o.target_market}`);
      }
    });
    return ['All Pairs', ...Array.from(pairs).sort()];
  }, [liveData]);

  const stats = useMemo(() => {
    const total = liveData.length;
    const avgRoi = total > 0 ? (liveData.reduce((s: number, o: any) => s + (parseFloat(o.roi) || 0), 0) / total) : 0;
    const totalProfit = liveData.reduce((s: number, o: any) => s + (parseFloat(o.net_profit) || 0), 0);
    const markets = new Set(liveData.flatMap((o: any) => [o.source_market, o.target_market].filter(Boolean))).size;
    return {
      total: total || marketStats.arbitrageCount,
      avgRoi: avgRoi.toFixed(1),
      totalProfit: totalProfit.toFixed(2),
      markets: markets || 4,
    };
  }, [liveData, marketStats]);

  const riskConfig: Record<string, { icon: any; color: string; bg: string; border: string; desc: string }> = {
    low: { icon: ShieldCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', desc: 'Low risk — high confidence, small price spread, both prices recently verified. Safe to act on.' },
    medium: { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', desc: 'Medium risk — moderate spread or one price may be slightly stale. Verify prices before trading.' },
    high: { icon: ShieldAlert, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', desc: 'High risk — large price spread, low confidence, or prices may be outdated. Proceed with caution and double-check listings.' },
  };
  const [riskTooltip, setRiskTooltip] = useState<{ key: string; x: number; y: number } | null>(null);

  const confidenceConfig: Record<string, { label: string; color: string; bg: string }> = {
    high:   { label: 'High',   color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    medium: { label: 'Med',    color: 'text-yellow-400',  bg: 'bg-yellow-500/10' },
    low:    { label: 'Low',    color: 'text-red-400',     bg: 'bg-red-500/10' },
  };

  const formatTimeSince = (dateStr: string) => {
    if (!dateStr) return 'just now';
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  // Skeleton shimmer rows
  const renderSkeleton = () => (
    <tbody>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="border-b border-white/[0.03]">
          {Array.from({ length: 9 }).map((_, j) => (
            <td key={j} className="py-4 px-4">
              <div className="h-4 rounded bg-white/[0.04] animate-pulse" style={{ width: j === 0 ? '180px' : '60px' }} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto fade-in">
      {/* Flash animation keyframe */}
      <style>{`
        @keyframes arbFlashPulse {
          0% { background-color: rgba(0, 229, 255, 0.10); }
          100% { background-color: transparent; }
        }
        .arb-flash-row {
          animation: arbFlashPulse 1s ease-out forwards;
        }
      `}</style>

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">Arbitrage Scanner</h1>
          <p className="text-sm text-gray-500 mt-1">Cross-market price discrepancy detection — real data from all markets</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={connected ? 'neon-dot' : ''} style={!connected ? { width: 8, height: 8, borderRadius: '50%', background: '#6b7280' } : {}}></div>
            <span className="text-[11px] text-gray-500 font-mono">
              {connected ? 'Live scanning' : 'Connecting...'}
            </span>
          </div>
          {/* Countdown to next refresh */}
          <div className="flex items-center gap-2">
            <div className="w-20 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full bg-cyan-glow/60 transition-all duration-1000 ease-linear"
                style={{ width: `${(countdown / 10) * 100}%` }}
              />
            </div>
            <span className="text-[10px] text-gray-500 font-mono w-8">{countdown}s</span>
          </div>
        </div>
      </div>

      {/* Best Opportunity Highlight */}
      {bestOpp && (
        <div
          className="glass-panel p-5 border-l-4 border-l-cyan-glow/60 relative overflow-hidden cursor-pointer hover:border-l-cyan-glow transition-all duration-200"
          onClick={() => openTrade(bestOpp)}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-glow/[0.03] to-transparent pointer-events-none"></div>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-cyan-glow/10">
                <Zap className="w-6 h-6 text-cyan-glow" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-cyan-glow font-bold uppercase tracking-widest">Best Opportunity</span>
                  <span className="text-[9px] text-gray-600 font-mono">refreshes every 10s</span>
                </div>
                <p className="text-lg font-bold text-white mt-1 flex items-center gap-2">
                  {bestOpp.skin_name}{getExteriorBadge(bestOpp.exterior)}
                  {bestOpp.min_float != null && bestOpp.max_float != null && (
                    <span className="text-[10px] font-mono text-cyan-glow/40 font-normal">
                      Float {Number(bestOpp.min_float).toFixed(2)}-{Number(bestOpp.max_float).toFixed(2)}
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-3 mt-1 text-xs font-mono">
                  <span className="text-gray-400">Buy on <span className="text-gray-300">{bestOpp.source_market}</span></span>
                  <ArrowRight className="w-3 h-3 text-cyan-glow/40" />
                  <span className="text-gray-400">Sell on <span className="text-gray-300">{bestOpp.target_market}</span></span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Buy Price</p>
                <p className="text-base font-bold font-mono text-white">${parseFloat(bestOpp.buy_price).toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Sell Price</p>
                <p className="text-base font-bold font-mono text-white">${parseFloat(bestOpp.sell_price).toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Net Profit</p>
                <p className="text-xl font-bold font-mono text-emerald-400">${parseFloat(bestOpp.net_profit).toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">ROI</p>
                <p className="text-lg font-bold font-mono text-cyan-glow">+{parseFloat(bestOpp.roi).toFixed(1)}%</p>
              </div>
              <button
                className="ml-2 flex items-center gap-2 px-4 py-3 rounded-xl bg-cyan-glow/10 text-cyan-glow text-xs font-bold uppercase tracking-wider hover:bg-cyan-glow/20 border border-cyan-glow/20 hover:border-cyan-glow/40 transition-all duration-200 hover:shadow-glow-cyan"
                onClick={(e) => {
                  e.stopPropagation();
                  openTrade(bestOpp);
                }}
              >
                <ShoppingCart className="w-4 h-4" />
                Trade Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="glass-panel-hover p-5 group">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Total Opportunities</p>
              <h3 className="text-2xl font-bold text-white mt-2 font-mono tracking-tight">{stats.total}</h3>
              <div className="flex items-center gap-1.5 mt-2">
                <div className="px-1.5 py-0.5 rounded text-[11px] font-bold font-mono bg-cyan-glow/10 text-cyan-glow">
                  LIVE
                </div>
                <span className="text-[10px] text-gray-600">real-time</span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-cyan-glow/[0.06] text-cyan-glow/60 group-hover:bg-cyan-glow/10 group-hover:text-cyan-glow transition-all duration-300">
              <Zap className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="glass-panel-hover p-5 group">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Average ROI</p>
              <h3 className="text-2xl font-bold text-white mt-2 font-mono tracking-tight">{stats.avgRoi}%</h3>
              <div className="flex items-center gap-1.5 mt-2">
                <div className="px-1.5 py-0.5 rounded text-[11px] font-bold font-mono bg-emerald-500/10 text-emerald-400">
                  {parseFloat(stats.avgRoi) > 0 ? '\u25b2' : '\u25bc'} {stats.avgRoi}%
                </div>
                <span className="text-[10px] text-gray-600">avg</span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-cyan-glow/[0.06] text-cyan-glow/60 group-hover:bg-cyan-glow/10 group-hover:text-cyan-glow transition-all duration-300">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="glass-panel-hover p-5 group">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Potential Profit</p>
              <h3 className="text-2xl font-bold text-white mt-2 font-mono tracking-tight">${stats.totalProfit}</h3>
              <div className="flex items-center gap-1.5 mt-2">
                <div className="px-1.5 py-0.5 rounded text-[11px] font-bold font-mono bg-emerald-500/10 text-emerald-400">
                  \u25b2 ${stats.totalProfit}
                </div>
                <span className="text-[10px] text-gray-600">total</span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-cyan-glow/[0.08] text-cyan-glow/60 group-hover:bg-cyan-glow/[0.12] group-hover:text-cyan-glow transition-all duration-300">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="glass-panel-hover p-5 group">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Active Markets</p>
              <h3 className="text-2xl font-bold text-white mt-2 font-mono tracking-tight">{stats.markets}</h3>
              <div className="flex items-center gap-1.5 mt-2">
                <div className="px-1.5 py-0.5 rounded text-[11px] font-bold font-mono bg-cyan-glow/10 text-cyan-glow">
                  LIVE
                </div>
                <span className="text-[10px] text-gray-600">{connected ? 'all connected' : 'reconnecting'}</span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-cyan-glow/[0.06] text-cyan-glow/60 group-hover:bg-cyan-glow/10 group-hover:text-cyan-glow transition-all duration-300">
              <BarChart3 className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Compact Filter Bar */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="text" placeholder="Search skins..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-carbon-900/60 border border-white/[0.06] text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-glow/30 transition-all font-mono" />
        </div>

        {/* Filter toggle */}
        <div className="relative">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-bold transition-all border ${
              showFilters || riskFilter !== 'All' || exteriorFilter !== 'All Conditions' || minRoi > 0 || minPrice || maxPrice || marketPair !== 'All Pairs'
                ? 'bg-cyan-glow/10 text-cyan-glow border-cyan-glow/20'
                : 'text-gray-500 hover:text-gray-300 border-white/[0.06] hover:bg-white/[0.04]'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {(riskFilter !== 'All' || exteriorFilter !== 'All Conditions' || minRoi > 0 || minPrice || maxPrice) && (
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-glow"></span>
            )}
          </button>

          {/* Filter dropdown */}
          {showFilters && (
            <div className="absolute top-full left-0 mt-2 glass-panel border border-white/[0.08] shadow-2xl p-5 w-[340px] z-50 space-y-4">
              {/* Risk */}
              <div>
                <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mb-2">Risk Level</p>
                <div className="flex gap-1">
                  {(['All', 'Low', 'Medium', 'High'] as RiskLevel[]).map((level) => (
                    <button key={level} onClick={() => setRiskFilter(level)}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${
                        riskFilter === level ? 'bg-cyan-glow/10 text-cyan-glow border border-cyan-glow/20' : 'text-gray-500 border border-transparent hover:bg-white/[0.04]'
                      }`}>{level}</button>
                  ))}
                </div>
              </div>
              {/* Exterior */}
              <div>
                <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mb-2">Condition</p>
                <select value={exteriorFilter} onChange={(e) => setExteriorFilter(e.target.value as ExteriorFilter)}
                  className="w-full px-3 py-2 rounded-lg bg-carbon-900/60 border border-white/[0.06] text-sm text-gray-300 focus:outline-none font-mono">
                  {exteriorOptions.map((ext) => <option key={ext} value={ext} className="bg-carbon-800">{ext}</option>)}
                </select>
              </div>
              {/* Market Pair */}
              <div>
                <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mb-2">Market Pair</p>
                <select value={marketPair} onChange={(e) => setMarketPair(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-carbon-900/60 border border-white/[0.06] text-sm text-gray-300 focus:outline-none font-mono">
                  {marketPairs.map((pair) => <option key={pair} value={pair} className="bg-carbon-800">{pair}</option>)}
                </select>
              </div>
              {/* Min ROI */}
              <div>
                <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mb-2">Min ROI: {minRoi}%</p>
                <input type="range" min={0} max={20} step={0.5} value={minRoi}
                  onChange={(e) => setMinRoi(parseFloat(e.target.value))} className="w-full accent-cyan-500" />
              </div>
              {/* Price Range */}
              <div>
                <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mb-2">Price Range</p>
                <div className="flex items-center gap-2">
                  <input type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="Min"
                    className="flex-1 px-2 py-2 rounded-lg bg-carbon-900/60 border border-white/[0.06] text-[11px] text-white font-mono focus:outline-none placeholder-gray-600" />
                  <span className="text-gray-600">–</span>
                  <input type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="Max"
                    className="flex-1 px-2 py-2 rounded-lg bg-carbon-900/60 border border-white/[0.06] text-[11px] text-white font-mono focus:outline-none placeholder-gray-600" />
                </div>
              </div>
              {/* Clear */}
              <button onClick={() => { setRiskFilter('All'); setExteriorFilter('All Conditions'); setMinRoi(0); setMarketPair('All Pairs'); setMinPrice(''); setMaxPrice(''); }}
                className="w-full py-2 rounded-lg text-[11px] text-gray-500 hover:text-white border border-white/[0.06] hover:bg-white/[0.04] transition-all">
                Clear All Filters
              </button>
            </div>
          )}
        </div>

        {/* Results count */}
        <p className="text-[11px] text-gray-500 font-mono ml-auto">
          {filteredOpportunities.length} results
        </p>

        {/* CSV export */}
        <button onClick={() => exportArbitrage(filteredOpportunities)}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-[11px] text-gray-500 hover:text-cyan-glow border border-white/[0.06] hover:border-cyan-glow/20 transition-all"
          title="Export to CSV">
          <Download className="w-3.5 h-3.5" /> CSV
        </button>
      </div>

      {/* Table */}
      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left py-4 px-6 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Skin</th>
                <th className="text-left py-4 px-4 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Source</th>
                <th className="text-center py-4 px-2 text-[10px] text-gray-500 font-semibold uppercase tracking-wider"></th>
                <th className="text-left py-4 px-4 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Target</th>
                <th className="text-right py-4 px-4 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Profit</th>
                <th className="text-right py-4 px-4 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">ROI</th>
                <th className="text-center py-4 px-4 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Risk</th>
                <th className="text-right py-4 px-4 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Detected</th>
                <th className="text-center py-4 px-4 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            {loading && liveData.length === 0 ? (
              renderSkeleton()
            ) : (
              <tbody>
                {filteredOpportunities
                  .sort((a: any, b: any) => {
                    const aKey = `${a.id || a.skin_name}`;
                    const bKey = `${b.id || b.skin_name}`;
                    // Pinned item always first
                    if (pinnedId && aKey === pinnedId) return -1;
                    if (pinnedId && bKey === pinnedId) return 1;
                    return (parseFloat(b.roi) || 0) - (parseFloat(a.roi) || 0);
                  })
                  .slice(0, showAll ? undefined : DEFAULT_ROW_COUNT)
                  .map((opp: any, index: number) => {
                    const risk = (opp.risk_level || 'low').toLowerCase();
                    const rc = riskConfig[risk] || riskConfig['low'];
                    const RiskIcon = rc.icon;
                    const buyPrice = parseFloat(opp.buy_price) || 0;
                    const sellPrice = parseFloat(opp.sell_price) || 0;
                    const profit = parseFloat(opp.net_profit) || 0;
                    const roi = parseFloat(opp.roi) || 0;
                    const rowKey = `${opp.skin_name}-${opp.source_market}-${opp.target_market}-${index}`;
                    const oppId = `${opp.id || opp.skin_name}`;
                    const isPinned = pinnedId === oppId;
                    const isExpanded = expandedRow === rowKey;
                    return (
                      <React.Fragment key={rowKey}>
                      <tr
                        className={`border-b border-white/[0.03] hover:bg-white/[0.02] transition-all duration-200 cursor-pointer group ${opp._flash ? 'arb-flash-row' : ''} ${isExpanded ? 'bg-white/[0.03]' : ''} ${isPinned ? 'bg-cyan-glow/[0.04] border-l-2 border-l-cyan-glow/40' : ''}`}
                        onClick={() => setExpandedRow(isExpanded ? null : rowKey)}
                      >
                        {/* Skin Name */}
                        <td className="py-4 px-6">
                          <div>
                            <p className="text-white font-medium text-[13px] group-hover:text-cyan-glow/90 transition-colors flex items-center">
                              <button
                                onClick={(e) => { e.stopPropagation(); setPinnedId(isPinned ? null : oppId); }}
                                className={`mr-2 flex-shrink-0 transition-all ${isPinned ? 'text-cyan-glow' : 'text-gray-700 opacity-0 group-hover:opacity-100 hover:text-cyan-glow/60'}`}
                                title={isPinned ? 'Unpin' : 'Pin to top'}
                              >
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
                              </button>
                              {opp.skin_name || 'Unknown Skin'}
                              {getExteriorBadge(opp.exterior)}
                            </p>
                            <p className="text-[11px] text-gray-600 font-mono mt-0.5 flex items-center gap-2">
                              <span>{opp.source_market} &rarr; {opp.target_market}</span>
                              {opp.exact_float ? (
                                <span className="text-cyan-glow/50">Float {Number(opp.exact_float).toFixed(6)}</span>
                              ) : opp.min_float != null && opp.max_float != null ? (
                                <span className="text-cyan-glow/30">Float {Number(opp.min_float).toFixed(2)}-{Number(opp.max_float).toFixed(2)}</span>
                              ) : null}
                            </p>
                          </div>
                        </td>

                        {/* Source Market */}
                        <td className="py-4 px-4">
                          <div>
                            <p className="text-gray-400 text-[12px] font-medium">{opp.source_market || 'N/A'}</p>
                            <p className="text-white font-mono text-[13px] font-semibold mt-0.5">
                              ${buyPrice.toFixed(2)}
                            </p>
                          </div>
                        </td>

                        {/* Arrow */}
                        <td className="py-4 px-2 text-center">
                          <div className="flex items-center justify-center">
                            <div className="w-8 h-[1px] bg-gradient-to-r from-transparent via-cyan-glow/30 to-transparent"></div>
                            <ArrowRight className="w-4 h-4 text-cyan-glow/40 mx-1 group-hover:text-cyan-glow transition-colors" />
                            <div className="w-8 h-[1px] bg-gradient-to-r from-transparent via-cyan-glow/30 to-transparent"></div>
                          </div>
                        </td>

                        {/* Target Market */}
                        <td className="py-4 px-4">
                          <div>
                            <p className="text-gray-300 text-[12px] font-medium">{opp.target_market || 'N/A'}</p>
                            <p className="text-white font-mono text-[13px] font-semibold mt-0.5">
                              ${sellPrice.toFixed(2)}
                            </p>
                          </div>
                        </td>

                        {/* Profit */}
                        <td className="py-4 px-4 text-right">
                          <span className="text-emerald-400 font-bold font-mono text-[14px]">
                            +${profit.toFixed(2)}
                          </span>
                        </td>

                        {/* ROI */}
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-12 h-1.5 rounded-full bg-carbon-700 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-cyan-glow/60 to-cyan-glow"
                                style={{ width: `${Math.min(roi * 5, 100)}%` }}
                              ></div>
                            </div>
                            <span className="text-cyan-glow font-bold font-mono text-[13px] w-14 text-right">
                              {roi.toFixed(1)}%
                            </span>
                          </div>
                        </td>

                        {/* Risk + Confidence */}
                        <td className="py-4 px-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                setRiskTooltip(riskTooltip?.key === rowKey ? null : { key: rowKey, x: Math.min(rect.left, window.innerWidth - 300), y: rect.bottom + 8 });
                              }}
                              className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg cursor-pointer hover:opacity-80 transition-opacity ${rc.color} ${rc.bg} border ${rc.border}`}
                            >
                              <RiskIcon className="w-3 h-3" />
                              {risk}
                            </button>
                            {(() => {
                              const conf = confidenceConfig[opp.confidence || 'low'] || confidenceConfig.low;
                              return (
                                <span className={`text-[8px] font-bold uppercase tracking-widest ${conf.color}`}>
                                  {conf.label} conf.
                                </span>
                              );
                            })()}
                          </div>
                        </td>

                        {/* Time */}
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Clock className="w-3 h-3 text-gray-600" />
                            <span className="text-[12px] text-gray-500 font-mono">{formatTimeSince(opp.created_at)}</span>
                          </div>
                        </td>

                        {/* Action */}
                        <td className="py-4 px-4 text-center">
                          <div className="flex items-center gap-1.5">
                            <a
                              href={getBuyUrl(opp)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-500/20 border border-emerald-500/10 hover:border-emerald-500/30 transition-all duration-200"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ShoppingCart className="w-2.5 h-2.5" />
                              Buy
                            </a>
                            <a
                              href={getSellUrl(opp)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cyan-glow/[0.08] text-cyan-glow text-[10px] font-bold uppercase tracking-wider hover:bg-cyan-glow/[0.18] border border-cyan-glow/10 hover:border-cyan-glow/30 transition-all duration-200"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="w-2.5 h-2.5" />
                              Sell
                            </a>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded detail panel */}
                      {isExpanded && (
                        <tr className="border-b border-white/[0.03]">
                          <td colSpan={8} className="p-0">
                            <div className="px-6 py-5 bg-carbon-900/40 border-t border-white/[0.04]">
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                {/* Skin Image */}
                                <div className="flex flex-col items-center justify-center">
                                  <div className="w-full aspect-square max-w-[200px] rounded-xl bg-carbon-800/60 border border-white/[0.06] overflow-hidden flex items-center justify-center p-2">
                                    {opp.image_url ? (
                                      <img
                                        src={opp.image_url}
                                        alt={opp.skin_name}
                                        className="w-full h-full object-contain drop-shadow-lg"
                                      />
                                    ) : (
                                      <div className="text-center">
                                        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-cyan-500/10 to-cyan-glow/5 border border-cyan-glow/10 flex items-center justify-center mx-auto mb-2">
                                          <span className="text-2xl font-bold text-cyan-glow/30">{(opp.weapon_name || 'S')[0]}</span>
                                        </div>
                                        <p className="text-[10px] text-gray-600 font-mono">{opp.weapon_name || 'Skin'}</p>
                                        <p className="text-[9px] text-gray-700 font-mono mt-0.5">Image loads after CSFloat sync</p>
                                      </div>
                                    )}
                                  </div>
                                  <Link
                                    to={`/skins/${opp.skin_id}`}
                                    className="mt-3 text-[10px] text-cyan-glow/60 hover:text-cyan-glow font-mono transition-colors"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    View full details →
                                  </Link>
                                </div>

                                {/* Skin Info */}
                                <div className="space-y-3">
                                  <h4 className="text-[11px] text-gray-500 uppercase tracking-wider font-bold">Skin Details</h4>
                                  <div className="space-y-2">
                                    <div className="flex justify-between">
                                      <span className="text-[11px] text-gray-500 font-mono">Name</span>
                                      <span className="text-[12px] text-white font-medium">{opp.skin_name}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-[11px] text-gray-500 font-mono">Exterior</span>
                                      <span className="text-[12px] text-white">{opp.exterior || 'Unknown'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-[11px] text-gray-500 font-mono">Float Range</span>
                                      <span className="text-[12px] text-cyan-glow font-mono">
                                        {opp.min_float != null ? Number(opp.min_float).toFixed(4) : '0.0000'} – {opp.max_float != null ? Number(opp.max_float).toFixed(4) : '1.0000'}
                                      </span>
                                    </div>
                                    {opp.exact_float && (
                                      <div className="flex justify-between">
                                        <span className="text-[11px] text-gray-500 font-mono">Exact Float</span>
                                        <span className="text-[12px] text-cyan-glow font-mono font-bold">
                                          {Number(opp.exact_float).toFixed(12)}
                                        </span>
                                      </div>
                                    )}
                                    {opp.paint_seed && (
                                      <div className="flex justify-between">
                                        <span className="text-[11px] text-gray-500 font-mono">Paint Seed</span>
                                        <span className="text-[12px] text-white font-mono">{opp.paint_seed}</span>
                                      </div>
                                    )}
                                    {opp.rarity && (
                                      <div className="flex justify-between">
                                        <span className="text-[11px] text-gray-500 font-mono">Rarity</span>
                                        <span className="text-[12px] text-white">{opp.rarity}</span>
                                      </div>
                                    )}
                                    {opp.weapon_name && (
                                      <div className="flex justify-between">
                                        <span className="text-[11px] text-gray-500 font-mono">Weapon</span>
                                        <span className="text-[12px] text-white">{opp.weapon_name}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Trade Info */}
                                <div className="space-y-3">
                                  <h4 className="text-[11px] text-gray-500 uppercase tracking-wider font-bold">Trade Details</h4>
                                  <div className="space-y-2">
                                    <div className="flex justify-between">
                                      <span className="text-[11px] text-gray-500 font-mono">Buy Price</span>
                                      <span className="text-[12px] text-white font-mono font-bold">${buyPrice.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-[11px] text-gray-500 font-mono">Sell Price</span>
                                      <span className="text-[12px] text-white font-mono font-bold">${sellPrice.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-[11px] text-gray-500 font-mono">Net Profit</span>
                                      <span className="text-[12px] text-emerald-400 font-mono font-bold">+${profit.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-[11px] text-gray-500 font-mono">ROI</span>
                                      <span className="text-[12px] text-cyan-glow font-mono font-bold">{roi.toFixed(1)}%</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-[11px] text-gray-500 font-mono">Margin</span>
                                      <span className="text-[12px] text-white font-mono">{parseFloat(opp.profit_margin || '0').toFixed(1)}%</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Actions */}
                                <div className="space-y-3">
                                  <h4 className="text-[11px] text-gray-500 uppercase tracking-wider font-bold">How to Trade</h4>

                                  {/* Last verified */}
                                  <p className="text-[10px] text-gray-600 font-mono mb-2">
                                    Last verified: {formatTimeSince(opp.created_at)}
                                    {opp.confidence && ` · Confidence: ${(confidenceConfig[opp.confidence] || confidenceConfig.low).label}`}
                                  </p>

                                  {/* Step-by-step instructions */}
                                  <div className="bg-carbon-800/60 rounded-xl p-3 border border-white/[0.04] space-y-2">
                                    <div className="flex items-start gap-2">
                                      <span className="text-[10px] font-bold text-cyan-glow bg-cyan-glow/10 rounded-full w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                                      <p className="text-[11px] text-gray-300">
                                        Buy the <span className="text-white font-bold">{opp.skin_name} ({opp.exterior})</span> on {opp.source_market} for <span className="text-emerald-400 font-bold">${buyPrice.toFixed(2)} or less</span>
                                      </p>
                                    </div>
                                    <div className="flex items-start gap-2">
                                      <span className="text-[10px] font-bold text-cyan-glow bg-cyan-glow/10 rounded-full w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                                      <p className="text-[11px] text-gray-300">
                                        List it on {opp.target_market} for <span className="text-cyan-glow font-bold">${sellPrice.toFixed(2)} or more</span>
                                      </p>
                                    </div>
                                    <div className="flex items-start gap-2">
                                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 rounded-full w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">$</span>
                                      <p className="text-[11px] text-emerald-400 font-medium">
                                        Estimated profit: ${profit.toFixed(2)} ({roi.toFixed(1)}% ROI after fees)
                                      </p>
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <a
                                      href={getBuyUrl(opp)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 text-[12px] font-bold border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <ShoppingCart className="w-3.5 h-3.5" />
                                      Buy on {opp.source_market} — ${buyPrice.toFixed(2)}
                                    </a>
                                    <a
                                      href={getSellUrl(opp)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-glow/[0.08] text-cyan-glow text-[12px] font-bold border border-cyan-glow/20 hover:bg-cyan-glow/[0.18] transition-all"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                      Sell on {opp.target_market} — ${sellPrice.toFixed(2)}
                                    </a>
                                    <Link
                                      to={`/skins/${opp.skin_id}`}
                                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] text-gray-300 text-[12px] font-bold border border-white/[0.08] hover:bg-white/[0.08] transition-all"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      View Full Skin Details
                                    </Link>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    );
                  })}
              </tbody>
            )}
          </table>
        </div>

        {/* Show More / Show Less Toggle */}
        {filteredOpportunities.length > DEFAULT_ROW_COUNT && (
          <div className="flex justify-center py-4 border-t border-white/[0.04]">
            <button
              onClick={() => setShowAll((prev) => !prev)}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white/[0.03] text-cyan-glow text-[11px] font-bold uppercase tracking-wider hover:bg-cyan-glow/10 border border-cyan-glow/15 hover:border-cyan-glow/30 transition-all duration-200 hover:shadow-glow-cyan backdrop-blur-sm font-mono"
            >
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showAll ? 'rotate-180' : ''}`} />
              {showAll ? 'Show Less' : `Show More (${filteredOpportunities.length - DEFAULT_ROW_COUNT} more)`}
            </button>
          </div>
        )}

        {/* Empty / Scanning State */}
        {!loading && liveData.length === 0 && (
          <div className="py-16 text-center">
            <Zap className="w-8 h-8 text-cyan-glow/30 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Waiting for multi-market data</p>
            <p className="text-gray-600 text-xs mt-2 font-mono max-w-md mx-auto">
              Arbitrage requires prices from 2+ markets to compare. Data is syncing from Skinport and Steam — opportunities will appear once cross-market prices are available.
            </p>
            <div className="flex items-center justify-center gap-2 mt-4">
              <div className="neon-dot" style={{ width: '5px', height: '5px', animation: 'smoothPulse 1.5s infinite' }}></div>
              <span className="text-[11px] text-cyan-glow/50 font-mono">Syncing market data...</span>
            </div>
          </div>
        )}

        {!loading && liveData.length > 0 && filteredOpportunities.length === 0 && (
          <div className="py-16 text-center">
            <Zap className="w-8 h-8 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No opportunities match your filters</p>
            <p className="text-gray-600 text-xs mt-1 font-mono">Try adjusting your risk level or minimum ROI</p>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.04] flex items-center justify-between">
          <p className="text-[11px] text-gray-600 font-mono">
            Data sourced from Steam, Buff163, Skinport, CSFloat
          </p>
          <button className="flex items-center gap-1.5 text-[11px] text-cyan-glow/60 hover:text-cyan-glow font-medium transition-colors">
            View full analysis <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>
      {/* Risk tooltip */}
      {riskTooltip && ReactDOM.createPortal(
        <>
          <div className="fixed inset-0" style={{ zIndex: 99998 }} onClick={() => setRiskTooltip(null)} />
          <div
            className="fixed glass-panel border border-white/[0.08] shadow-2xl p-4 w-[280px]"
            style={{ zIndex: 99999, top: riskTooltip.y, left: riskTooltip.x }}
          >
            {(() => {
              const opp = filteredOpportunities.find((_: any, i: number) => {
                const k = `${_.skin_name}-${_.source_market}-${_.target_market}-${i}`;
                return k === riskTooltip.key;
              });
              const r = (opp?.risk_level || 'low').toLowerCase();
              const cfg = riskConfig[r] || riskConfig.low;
              const Icon = cfg.icon;
              return (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                    <span className={`text-sm font-bold uppercase ${cfg.color}`}>{r} Risk</span>
                  </div>
                  <p className="text-[12px] text-gray-400 leading-relaxed">{cfg.desc}</p>
                </div>
              );
            })()}
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

export default Arbitrage;
