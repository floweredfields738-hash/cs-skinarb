import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Star,
  Plus,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  ArrowUpDown,
  Eye,
  Search,
  Target,
  TrendingUp,
} from 'lucide-react';
import { useLiveSkinsList, useConnectionStatus } from '../hooks/useRealTimeData';

// ── Helpers ──────────────────────────────────────────────────────────────────

function clsx(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

// Seeded random for deterministic sparkline generation per skin
function seededRandom(seed: number) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function generateSparklineFromSeed(seed: number, basePrice: number): number[] {
  const points: number[] = [];
  let val = basePrice * 0.95;
  for (let i = 0; i < 10; i++) {
    val += (seededRandom(seed + i * 13) - 0.45) * basePrice * 0.03;
    val = Math.max(basePrice * 0.85, Math.min(basePrice * 1.15, val));
    points.push(val);
  }
  return points;
}

const RARITY_COLORS: Record<string, string> = {
  Covert: '#eb4b4b',
  Classified: '#d32ee6',
  Restricted: '#8847ff',
  'Mil-Spec': '#4b69ff',
  'Mil-Spec Grade': '#4b69ff',
  Industrial: '#5e98d9',
  'Industrial Grade': '#5e98d9',
  Consumer: '#b0c3d9',
  'Consumer Grade': '#b0c3d9',
};

type SortKey = 'price' | 'change' | 'score';

// ── Mini Sparkline SVG ───────────────────────────────────────────────────────

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const pathD = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 100 - ((val - min) / range) * 80 - 10;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  const color = positive ? '#34d399' : '#f87171';

  return (
    <svg viewBox="0 0 100 100" className="w-full h-10" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`spark-${positive ? 'up' : 'down'}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={`${color}30`} />
          <stop offset="100%" stopColor={`${color}00`} />
        </linearGradient>
      </defs>
      <path d={pathD + ' L 100 100 L 0 100 Z'} fill={`url(#spark-${positive ? 'up' : 'down'})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// ── Watchlist Card ───────────────────────────────────────────────────────────

interface WatchlistCardItem {
  id: string;
  name: string;
  weapon: string;
  skinName: string;
  price: number;
  change24h: number;
  changePct24h: number;
  opportunityScore: number;
  sparkline: number[];
  rarity: string;
  rarityColor: string;
  _flash?: boolean;
}

function WatchlistCard({
  item,
  onRemove,
}: {
  item: WatchlistCardItem;
  onRemove: (id: string) => void;
}) {
  const isPositive = item.changePct24h >= 0;
  const scoreColor =
    item.opportunityScore >= 80
      ? 'text-cyan-glow'
      : item.opportunityScore >= 60
      ? 'text-gold-400'
      : 'text-gray-400';

  return (
    <Link to={`/skins/${item.id}`} className="block group">
      <div className={clsx(
        'glass-panel-hover p-5 h-full relative overflow-hidden',
        item._flash && 'watchlist-flash-card'
      )}>
        {/* Rarity accent line at top */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{
            background: `linear-gradient(90deg, transparent, ${item.rarityColor}80, transparent)`,
          }}
        />

        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate group-hover:text-cyan-glow/90 transition-colors">
              {item.name}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span
                className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: `${item.rarityColor}18`,
                  color: item.rarityColor,
                }}
              >
                {item.rarity}
              </span>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemove(item.id);
            }}
            className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
            title="Remove from watchlist"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Price + Change */}
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Price</p>
            <p className="text-xl font-bold font-mono text-white tracking-tight">
              ${item.price < 1000 ? item.price.toFixed(2) : item.price.toLocaleString('en-US', { minimumFractionDigits: 0 })}
            </p>
          </div>
          <div className={clsx(
            'flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold font-mono',
            isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
          )}>
            {isPositive
              ? <ArrowUpRight className="w-3 h-3" />
              : <ArrowDownRight className="w-3 h-3" />}
            {isPositive ? '+' : ''}{item.changePct24h.toFixed(2)}%
          </div>
        </div>

        {/* Sparkline */}
        <div className="mb-3 -mx-1">
          <Sparkline data={item.sparkline} positive={isPositive} />
        </div>

        {/* Opportunity Score */}
        <div className="flex items-center justify-between pt-3 border-t border-white/[0.04]">
          <div className="flex items-center gap-2">
            <Target className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">Opportunity</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-14 bg-carbon-900/80 rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full transition-all duration-500"
                style={{
                  width: `${item.opportunityScore}%`,
                  background:
                    item.opportunityScore >= 80
                      ? 'linear-gradient(90deg, rgba(0, 229, 255, 0.7), rgba(0, 229, 255, 1))'
                      : item.opportunityScore >= 60
                      ? 'linear-gradient(90deg, rgba(245, 158, 11, 0.6), rgba(252, 211, 77, 0.9))'
                      : 'linear-gradient(90deg, rgba(156, 163, 175, 0.4), rgba(156, 163, 175, 0.6))',
                  boxShadow:
                    item.opportunityScore >= 80
                      ? '0 0 6px rgba(0, 229, 255, 0.4)'
                      : item.opportunityScore >= 60
                      ? '0 0 6px rgba(245, 158, 11, 0.3)'
                      : 'none',
                }}
              />
            </div>
            <span className={clsx('text-sm font-bold font-mono', scoreColor)}>
              {item.opportunityScore}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="glass-panel p-12 flex flex-col items-center justify-center text-center">
      <div className="p-4 rounded-2xl bg-cyan-glow/[0.06] mb-5">
        <Eye className="w-10 h-10 text-cyan-glow/40" />
      </div>
      <h3 className="text-lg font-bold text-white mb-2">No skins in your watchlist</h3>
      <p className="text-sm text-gray-500 max-w-sm mb-6">
        Add skins to your watchlist to track prices, monitor opportunities, and get alerts on market movements.
      </p>
      <Link
        to="/"
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-glow/10 border border-cyan-glow/20 text-cyan-glow text-[13px] font-bold hover:bg-cyan-glow/20 transition-all"
      >
        <Plus className="w-4 h-4" />
        Browse Skins
      </Link>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

const Watchlist: React.FC = () => {
  const { skins, loading } = useLiveSkinsList();
  const connected = useConnectionStatus();
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortKey>('score');
  const [searchQuery, setSearchQuery] = useState('');
  const [secondsAgo, setSecondsAgo] = useState(0);
  const lastUpdateRef = useRef(Date.now());
  const sparklineCacheRef = useRef<Record<string, number[]>>({});

  // Reset timer on data change
  useEffect(() => {
    if (skins.length > 0) {
      lastUpdateRef.current = Date.now();
      setSecondsAgo(0);
    }
  }, [skins]);

  // Tick timer
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdateRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Transform skins to watchlist items (first 8, excluding removed)
  const watchlistItems = useMemo(() => {
    const available = skins.filter((s: any) => {
      const id = String(s.id || '');
      return !removedIds.has(id);
    });

    return available.slice(0, 8).map((skin: any) => {
      const id = String(skin.id || '');
      const price = parseFloat(skin.current_price) || 0;
      const changePct = parseFloat(skin.change_24h) || 0;
      const changeAmt = price * (changePct / 100);
      const rarity = skin.rarity || 'Mil-Spec';
      const rarityColor = RARITY_COLORS[rarity] || RARITY_COLORS['Mil-Spec'];
      const seed = typeof skin.id === 'number' ? skin.id : parseInt(skin.id, 10) || 1;

      // Compute opportunity score from change and price
      const absChange = Math.abs(changePct);
      const opportunityScore = Math.min(99, Math.max(20, Math.round(50 + absChange * 5 + seededRandom(seed + 99) * 20)));

      // Generate or shift sparkline
      let sparkline = sparklineCacheRef.current[id];
      if (!sparkline) {
        sparkline = generateSparklineFromSeed(seed, price);
        sparklineCacheRef.current[id] = sparkline;
      }
      // If price updated (_flash), shift the sparkline
      if (skin._flash && sparkline.length > 0) {
        const shifted = [...sparkline.slice(1), price];
        sparklineCacheRef.current[id] = shifted;
        sparkline = shifted;
      }

      const name = skin.name || `${skin.weapon_name || 'Unknown'} | ${skin.skin_name || 'Skin'}`;
      const weapon = skin.weapon_name || name.split('|')[0].trim();
      const skinName = skin.skin_name || (name.includes('|') ? name.split('|')[1].trim() : name);

      return {
        id,
        name,
        weapon,
        skinName,
        price,
        change24h: changeAmt,
        changePct24h: changePct,
        opportunityScore,
        sparkline,
        rarity,
        rarityColor,
        _flash: skin._flash || false,
      } as WatchlistCardItem;
    });
  }, [skins, removedIds]);

  const handleRemove = (id: string) => {
    setRemovedIds((prev) => new Set([...prev, id]));
  };

  const filteredAndSorted = useMemo(() => {
    let result = [...watchlistItems];

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.weapon.toLowerCase().includes(q) ||
          item.skinName.toLowerCase().includes(q)
      );
    }

    // Sort
    switch (sortBy) {
      case 'price':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'change':
        result.sort((a, b) => b.changePct24h - a.changePct24h);
        break;
      case 'score':
        result.sort((a, b) => b.opportunityScore - a.opportunityScore);
        break;
    }

    return result;
  }, [watchlistItems, sortBy, searchQuery]);

  // Summary stats from live data
  const totalValue = watchlistItems.reduce((sum, item) => sum + item.price, 0);
  const totalChange = watchlistItems.reduce((sum, item) => sum + item.change24h, 0);
  const risingCount = watchlistItems.filter((i) => i.changePct24h > 0).length;
  const fallingCount = watchlistItems.filter((i) => i.changePct24h < 0).length;
  const avgScore = watchlistItems.length > 0
    ? Math.round(watchlistItems.reduce((sum, item) => sum + item.opportunityScore, 0) / watchlistItems.length)
    : 0;

  const showEmpty = !loading && watchlistItems.length === 0;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto fade-in">
      {/* Flash animation */}
      <style>{`
        @keyframes watchlistCardPulse {
          0% { box-shadow: inset 0 0 20px rgba(0, 229, 255, 0.15); }
          100% { box-shadow: inset 0 0 0px transparent; }
        }
        .watchlist-flash-card {
          animation: watchlistCardPulse 1s ease-out forwards;
        }
      `}</style>

      {/* ═══════════════ HEADER ═══════════════ */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Star className="w-5 h-5 text-gold-400" />
            <h1 className="text-2xl font-bold text-white tracking-tight">Watchlist</h1>
          </div>
          <p className="text-sm text-gray-500">
            Tracking <span className="text-gray-300 font-mono font-bold">{watchlistItems.length}</span> skins
            &bull; Updated <span className="text-gray-400 font-mono">{secondsAgo}s ago</span>
            {connected && (
              <span className="ml-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-glow animate-pulse mr-1" />
                <span className="text-cyan-glow/60 text-[11px] font-mono">Live</span>
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-glow/10 border border-cyan-glow/20 text-cyan-glow text-[12px] font-bold hover:bg-cyan-glow/20 transition-all">
            <Plus className="w-3.5 h-3.5" />
            Add Skin
          </button>
        </div>
      </div>

      {showEmpty ? (
        <EmptyState />
      ) : (
        <>
          {/* ═══════════════ SUMMARY STATS ═══════════════ */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-panel-hover p-5">
              <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Watchlist Value</p>
              <h3 className="text-2xl font-bold text-white mt-2 font-mono tracking-tight">
                ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <div className="flex items-center gap-1.5 mt-2">
                <div className={clsx(
                  'px-1.5 py-0.5 rounded text-[11px] font-bold font-mono',
                  totalChange >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                )}>
                  {totalChange >= 0 ? '\u25b2' : '\u25bc'} ${Math.abs(totalChange).toFixed(2)}
                </div>
                <span className="text-[10px] text-gray-600">24h</span>
              </div>
            </div>

            <div className="glass-panel-hover p-5">
              <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Items Tracked</p>
              <h3 className="text-2xl font-bold text-white mt-2 font-mono tracking-tight">{watchlistItems.length}</h3>
              <div className="flex items-center gap-1.5 mt-2">
                <div className="px-1.5 py-0.5 rounded text-[11px] font-bold font-mono bg-emerald-500/10 text-emerald-400">
                  {risingCount} rising
                </div>
                <div className="px-1.5 py-0.5 rounded text-[11px] font-bold font-mono bg-red-500/10 text-red-400">
                  {fallingCount} falling
                </div>
              </div>
            </div>

            <div className="glass-panel-hover p-5">
              <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Avg Opportunity Score</p>
              <h3 className="text-2xl font-bold text-white mt-2 font-mono tracking-tight">{avgScore}</h3>
              <div className="w-full bg-carbon-900/80 rounded-full h-1.5 mt-3">
                <div
                  className="h-1.5 rounded-full"
                  style={{
                    width: `${avgScore}%`,
                    background: avgScore >= 80
                      ? 'linear-gradient(90deg, rgba(0, 229, 255, 0.7), rgba(0, 229, 255, 1))'
                      : 'linear-gradient(90deg, rgba(245, 158, 11, 0.6), rgba(252, 211, 77, 0.9))',
                    boxShadow: avgScore >= 80
                      ? '0 0 8px rgba(0, 229, 255, 0.3)'
                      : '0 0 8px rgba(245, 158, 11, 0.3)',
                  }}
                />
              </div>
            </div>
          </div>

          {/* ═══════════════ TOOLBAR ═══════════════ */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            {/* Search */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search watchlist..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-carbon-800/60 border border-white/[0.06] text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-glow/30 transition-colors font-mono"
              />
            </div>

            {/* Sort buttons */}
            <div className="flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-gray-500 mr-1" />
              {([
                { key: 'score' as SortKey, label: 'Score' },
                { key: 'price' as SortKey, label: 'Price' },
                { key: 'change' as SortKey, label: '24h Change' },
              ]).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setSortBy(opt.key)}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-[11px] font-bold font-mono transition-all duration-200',
                    sortBy === opt.key
                      ? 'bg-cyan-glow/10 text-cyan-glow border border-cyan-glow/20'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* ═══════════════ CARDS GRID ═══════════════ */}
          {loading && watchlistItems.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="glass-panel-hover p-5 h-48">
                  <div className="h-4 w-32 rounded bg-white/[0.04] animate-pulse mb-3" />
                  <div className="h-3 w-16 rounded bg-white/[0.04] animate-pulse mb-4" />
                  <div className="h-7 w-24 rounded bg-white/[0.06] animate-pulse mb-3" />
                  <div className="h-10 w-full rounded bg-white/[0.03] animate-pulse mb-3" />
                  <div className="h-3 w-full rounded bg-white/[0.04] animate-pulse" />
                </div>
              ))}
            </div>
          ) : filteredAndSorted.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredAndSorted.map((item) => (
                <WatchlistCard key={item.id} item={item} onRemove={handleRemove} />
              ))}
            </div>
          ) : (
            <div className="glass-panel p-8 text-center">
              <Search className="w-8 h-8 text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No skins match your search.</p>
              <button
                onClick={() => setSearchQuery('')}
                className="mt-3 text-[12px] text-cyan-glow hover:underline"
              >
                Clear search
              </button>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-center gap-2 pb-4">
            <TrendingUp className="w-3 h-3 text-gray-600" />
            <span className="text-[10px] text-gray-600 font-mono">
              Prices sourced from Steam, Buff163, Skinport, CSFloat
            </span>
            <div className="neon-dot" style={{ width: 5, height: 5 }} />
          </div>
        </>
      )}
    </div>
  );
};

export default Watchlist;
