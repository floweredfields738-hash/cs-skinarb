import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Star, Plus, Trash2, ArrowUpDown,
  Eye, Search, Target, TrendingUp, Bell,
} from 'lucide-react';
import { watchlistApi, marketApi } from '../api/services';
import { useConnectionStatus } from '../hooks/useRealTimeData';
import AnimatedNumber from '../components/common/AnimatedNumber';

function clsx(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

const RARITY_COLORS: Record<string, string> = {
  Covert: '#eb4b4b', Classified: '#d32ee6', Restricted: '#8847ff',
  'Mil-Spec': '#4b69ff', 'Industrial Grade': '#5e98d9', 'Consumer Grade': '#b0c3d9',
  Extraordinary: '#e4ae39',
};

interface WatchlistItem {
  id: number;
  skin_id: number;
  name: string;
  weapon_name: string;
  skin_name: string;
  rarity: string;
  min_float: number;
  max_float: number;
  current_price: number | null;
  target_price: number | null;
  hit_target: boolean;
  market_count: number;
  added_at: string;
}

type SortKey = 'price' | 'name' | 'added';

const Watchlist: React.FC = () => {
  const connected = useConnectionStatus();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortKey>('added');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTarget, setEditingTarget] = useState<number | null>(null);
  const [targetInput, setTargetInput] = useState('');
  const [addQuery, setAddQuery] = useState('');
  const [addResults, setAddResults] = useState<any[]>([]);
  const [addLoading, setAddLoading] = useState(false);
  const [showAddResults, setShowAddResults] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);
  const addDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch watchlist
  const fetchWatchlist = useCallback(() => {
    watchlistApi.get()
      .then(res => {
        if (res.data?.success) {
          setItems(res.data.items || []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchWatchlist();
    // Refresh every 30 seconds for live prices
    const interval = setInterval(fetchWatchlist, 30000);
    return () => clearInterval(interval);
  }, [fetchWatchlist]);

  // Click outside to close search results
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (addRef.current && !addRef.current.contains(e.target as Node)) setShowAddResults(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Search for skins to add
  const handleAddSearch = useCallback((q: string) => {
    setAddQuery(q);
    if (addDebounceRef.current) clearTimeout(addDebounceRef.current);
    if (q.length < 2) { setAddResults([]); setShowAddResults(false); return; }
    setAddLoading(true);
    addDebounceRef.current = setTimeout(() => {
      marketApi.searchSkins(q, 15)
        .then(res => {
          const data = res.data?.data || res.data || [];
          setAddResults(Array.isArray(data) ? data : []);
          setShowAddResults(true);
        })
        .catch(() => setAddResults([]))
        .finally(() => setAddLoading(false));
    }, 300);
  }, []);

  // Add skin from search results
  const handleAddSkin = async (skinId: number) => {
    try {
      await watchlistApi.add(skinId);
      setShowAddResults(false);
      setAddQuery('');
      fetchWatchlist(); // Refresh the list
    } catch {}
  };

  // Remove from watchlist
  const handleRemove = async (skinId: number) => {
    try {
      await watchlistApi.remove(skinId);
      setItems(prev => prev.filter(i => i.skin_id !== skinId));
    } catch {}
  };

  // Set target price
  const handleSetTarget = async (skinId: number) => {
    const price = parseFloat(targetInput);
    if (isNaN(price) || price <= 0) return;
    try {
      await watchlistApi.updateTarget(skinId, price);
      setItems(prev => prev.map(i =>
        i.skin_id === skinId ? { ...i, target_price: price, hit_target: i.current_price !== null && i.current_price <= price } : i
      ));
      setEditingTarget(null);
      setTargetInput('');
    } catch {}
  };

  // Filter and sort
  const filteredItems = useMemo(() => {
    let result = [...items];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(i => i.name.toLowerCase().includes(q));
    }

    switch (sortBy) {
      case 'price':
        result.sort((a, b) => (b.current_price || 0) - (a.current_price || 0));
        break;
      case 'name':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'added':
        result.sort((a, b) => new Date(b.added_at).getTime() - new Date(a.added_at).getTime());
        break;
    }

    return result;
  }, [items, sortBy, searchQuery]);

  // Stats
  const totalValue = items.reduce((sum, i) => sum + (i.current_price || 0), 0);
  const alertCount = items.filter(i => i.hit_target).length;

  if (loading) {
    return (
      <div className="space-y-6 max-w-[1600px] mx-auto fade-in">
        <div className="flex items-center gap-3 mb-1">
          <Star className="w-5 h-5 text-gold-400" />
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">Watchlist</h1>
        </div>
        <div className="glass-panel p-12 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-cyan-glow/30 border-t-cyan-glow rounded-full animate-spin" />
          <span className="ml-3 text-sm text-gray-500 font-mono">Loading watchlist...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Star className="w-5 h-5 text-gold-400" />
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">Watchlist</h1>
          </div>
          <p className="text-sm text-gray-500">
            Tracking <span className="text-gray-300 font-mono font-bold">{items.length}</span> skins
            {connected && (
              <span className="ml-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-glow animate-pulse mr-1" />
                <span className="text-cyan-glow/60 text-[11px] font-mono">Live</span>
              </span>
            )}
          </p>
        </div>
        {/* Add skin search */}
        <div className="relative w-full md:w-80" ref={addRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={addQuery}
            onChange={e => handleAddSearch(e.target.value)}
            onFocus={() => addResults.length > 0 && setShowAddResults(true)}
            placeholder="Search skins to add..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-carbon-800/60 border border-white/[0.06] text-sm text-white placeholder-gray-600 font-mono focus:outline-none focus:border-cyan-glow/30 transition-all"
          />
          {addLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-cyan-glow/30 border-t-cyan-glow rounded-full animate-spin" />
            </div>
          )}
          {showAddResults && addResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 rounded-xl bg-carbon-800/95 backdrop-blur-xl border border-white/[0.08] shadow-2xl max-h-80 overflow-y-auto" style={{ zIndex: 9999 }}>
              {addResults.map((skin: any) => {
                const alreadyAdded = items.some(i => i.skin_id === skin.id);
                const price = skin.current_price ? parseFloat(String(skin.current_price)) : null;
                const rarityColor = RARITY_COLORS[skin.rarity] || '#6b7280';
                return (
                  <button
                    key={skin.id}
                    onClick={() => !alreadyAdded && handleAddSkin(skin.id)}
                    disabled={alreadyAdded}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all border-b border-white/[0.03] last:border-b-0 ${
                      alreadyAdded ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/[0.04] cursor-pointer'
                    }`}
                  >
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: rarityColor }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-white font-medium truncate">{skin.name}</div>
                      <div className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">{skin.rarity}</div>
                    </div>
                    {price !== null && (
                      <span className="text-[12px] font-mono text-gray-300 flex-shrink-0">${price.toFixed(2)}</span>
                    )}
                    {alreadyAdded ? (
                      <span className="text-[10px] text-gold-400 font-mono flex-shrink-0">Watching</span>
                    ) : (
                      <Plus className="w-4 h-4 text-cyan-glow/50 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        /* Empty state */
        <div className="glass-panel p-12 flex flex-col items-center justify-center text-center">
          <div className="p-4 rounded-2xl bg-cyan-glow/[0.06] mb-5">
            <Eye className="w-10 h-10 text-cyan-glow/40" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">No skins in your watchlist</h3>
          <p className="text-sm text-gray-500 max-w-sm mb-6">
            Search for skins on the Market Monitor or Skin Detail pages and click "Add to Watchlist" to start tracking prices.
          </p>
          <p className="text-[11px] text-gray-600 font-mono">Use the search bar above to find and add skins</p>
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-panel p-5">
              <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Watchlist Value</p>
              <div className="mt-2">
                <AnimatedNumber value={totalValue} prefix="$" decimals={2} duration={500} className="text-2xl font-bold text-white font-mono" />
              </div>
            </div>
            <div className="glass-panel p-5">
              <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Items Tracked</p>
              <p className="text-2xl font-bold text-white mt-2 font-mono">{items.length}</p>
              <p className="text-[10px] text-gray-600 font-mono mt-1">across {new Set(items.map(i => i.weapon_name)).size} weapon types</p>
            </div>
            <div className="glass-panel p-5">
              <div className="flex items-center gap-2">
                <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Price Alerts</p>
                {alertCount > 0 && <Bell className="w-3.5 h-3.5 text-gold-400 animate-pulse" />}
              </div>
              <p className="text-2xl font-bold text-white mt-2 font-mono">{alertCount}</p>
              <p className="text-[10px] text-gray-600 font-mono mt-1">
                {alertCount > 0 ? `${alertCount} skin${alertCount > 1 ? 's' : ''} hit target price!` : 'Set target prices to get alerts'}
              </p>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
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
            <div className="flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-gray-500 mr-1" />
              {([
                { key: 'added' as SortKey, label: 'Recent' },
                { key: 'price' as SortKey, label: 'Price' },
                { key: 'name' as SortKey, label: 'Name' },
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

          {/* Skin cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredItems.map(item => {
              const rarityColor = RARITY_COLORS[item.rarity] || '#6b7280';

              return (
                <div key={item.skin_id} className="glass-panel-hover p-5 relative overflow-hidden group">
                  {/* Rarity accent */}
                  <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${rarityColor}80, transparent)` }} />

                  {/* Hit target indicator */}
                  {item.hit_target && (
                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-gold-400/15 border border-gold-400/30">
                      <span className="text-[9px] font-bold text-gold-400 uppercase tracking-wider">Target Hit!</span>
                    </div>
                  )}

                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <Link to={`/skins/${item.skin_id}`} className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate hover:text-cyan-glow/90 transition-colors">
                        {item.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: `${rarityColor}18`, color: rarityColor }}>
                          {item.rarity}
                        </span>
                        <span className="text-[9px] font-mono text-cyan-glow/40">
                          Float {item.min_float.toFixed(2)}-{item.max_float.toFixed(2)}
                        </span>
                      </div>
                    </Link>
                    <button
                      onClick={() => handleRemove(item.skin_id)}
                      className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Price */}
                  <div className="flex items-end justify-between mb-4">
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Current Price</p>
                      {item.current_price ? (
                        <AnimatedNumber value={item.current_price} prefix="$" decimals={2} duration={500}
                          className="text-xl font-bold font-mono text-white tracking-tight" />
                      ) : (
                        <span className="text-xl font-bold font-mono text-gray-600">—</span>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Markets</p>
                      <p className="text-sm font-bold font-mono text-gray-300">{item.market_count}</p>
                    </div>
                  </div>

                  {/* Target price */}
                  <div className="pt-3 border-t border-white/[0.04]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Target className="w-3.5 h-3.5 text-gray-500" />
                        <span className="text-[10px] text-gray-500 uppercase tracking-wider">Target Price</span>
                      </div>
                      {editingTarget === item.skin_id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={targetInput}
                            onChange={e => setTargetInput(e.target.value)}
                            placeholder="0.00"
                            className="w-20 px-2 py-1 rounded bg-carbon-900/60 border border-white/[0.1] text-[11px] text-white font-mono focus:outline-none focus:border-cyan-glow/30"
                            autoFocus
                            onKeyDown={e => { if (e.key === 'Enter') handleSetTarget(item.skin_id); if (e.key === 'Escape') setEditingTarget(null); }}
                          />
                          <button onClick={() => handleSetTarget(item.skin_id)} className="text-[10px] text-cyan-glow font-bold">Set</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditingTarget(item.skin_id); setTargetInput(item.target_price?.toString() || ''); }}
                          className="text-sm font-bold font-mono text-gray-400 hover:text-cyan-glow transition-colors"
                        >
                          {item.target_price ? `$${item.target_price.toFixed(2)}` : 'Set target'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-center gap-2 pb-4">
            <TrendingUp className="w-3 h-3 text-gray-600" />
            <span className="text-[10px] text-gray-600 font-mono">
              All prices from real market data — refreshes every 30s
            </span>
          </div>
        </>
      )}
    </div>
  );
};

export default Watchlist;
