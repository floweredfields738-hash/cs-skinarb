import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { Package, RefreshCw, Lock, ExternalLink, Download } from 'lucide-react';
import { exportInventory } from '../utils/csvExport';

interface InventoryItem {
  name: string;
  market_hash_name: string;
  icon_url: string | null;
  rarity: string | null;
  exterior: string | null;
  type: string | null;
  weapon: string | null;
  tradable: boolean;
  marketable: boolean;
  quantity: number;
  market_price: number | null;
  total_value: number | null;
  name_color: string | null;
}

interface InventoryData {
  steam_id: string;
  total_items: number;
  unique_items: number;
  tradable_items: number;
  total_value: number;
  items: InventoryItem[];
}

const RARITY_COLORS: Record<string, string> = {
  Covert: '#eb4b4b',
  Classified: '#d32ee6',
  Restricted: '#8847ff',
  'Mil-Spec Grade': '#4b69ff',
  'Industrial Grade': '#5e98d9',
  'Consumer Grade': '#b0c3d9',
  Extraordinary: '#e4ae39',
  'Base Grade': '#b0c3d9',
  'High Grade': '#4b69ff',
  Remarkable: '#8847ff',
  Exotic: '#d32ee6',
  'Distinguished': '#8847ff',
  'Superior': '#d32ee6',
  'Master': '#eb4b4b',
};

const Inventory: React.FC = () => {
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [inventory, setInventory] = useState<InventoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'weapons' | 'knives' | 'gloves' | 'stickers' | 'agents'>('all');
  const [sortBy, setSortBy] = useState<'value' | 'name' | 'rarity'>('value');

  const fetchInventory = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch('/api/portfolio/inventory', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setInventory(data.inventory);
      } else {
        setError(data.error || 'Failed to load inventory');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) fetchInventory();
  }, [isAuthenticated]);

  const filteredItems = inventory?.items.filter(item => {
    if (filter === 'all') return true;
    const type = (item.type || '').toLowerCase();
    const name = (item.name || '').toLowerCase();
    if (filter === 'weapons') return ['pistol', 'rifle', 'smg', 'shotgun', 'machinegun', 'sniper rifle'].some(t => type.includes(t));
    if (filter === 'knives') return type.includes('knife') || name.includes('knife') || name.includes('bayonet') || name.includes('karambit') || name.includes('daggers');
    if (filter === 'gloves') return type.includes('gloves') || name.includes('gloves') || name.includes('wraps');
    if (filter === 'stickers') return type.includes('sticker');
    if (filter === 'agents') return type.includes('agent');
    return true;
  }).sort((a, b) => {
    if (sortBy === 'value') return (b.total_value || 0) - (a.total_value || 0);
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    return 0;
  }) || [];

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center glass-panel p-10 max-w-md">
          <Lock className="w-12 h-12 text-cyan-glow/30 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Sign In Required</h2>
          <p className="text-gray-500 text-sm mb-6">Link your Steam account to view your CS2 inventory with live market valuations.</p>
          <a
            href="/api/auth/steam"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-glow text-carbon-950 font-bold text-sm hover:shadow-glow-cyan transition-all"
          >
            Sign In with Steam
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Actions */}
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-2">
          {inventory && inventory.items.length > 0 && (
            <button
              onClick={() => exportInventory(inventory.items)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] text-gray-500 hover:text-cyan-glow border border-white/[0.06] hover:border-cyan-glow/20 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
          )}
          <button
            onClick={fetchInventory}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.06] transition-all text-sm text-gray-300"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      {inventory && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <div className="glass-panel p-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-1">Total Items</p>
            <p className="text-xl font-bold text-white">{inventory.total_items}</p>
          </div>
          <div className="glass-panel p-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-1">Unique Items</p>
            <p className="text-xl font-bold text-white">{inventory.unique_items}</p>
          </div>
          <div className="glass-panel p-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-1">Tradable</p>
            <p className="text-xl font-bold text-cyan-glow">{inventory.tradable_items}</p>
          </div>
          <div className="glass-panel p-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-1">Estimated Value</p>
            <p className="text-xl font-bold text-emerald-400">${inventory.total_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(['all', 'weapons', 'knives', 'gloves', 'stickers', 'agents'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filter === f
                  ? 'bg-cyan-glow/10 text-cyan-glow border border-cyan-glow/20'
                  : 'text-gray-500 hover:text-gray-300 border border-transparent'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 font-mono">Sort:</span>
          {(['value', 'name', 'rarity'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
                sortBy === s ? 'text-cyan-glow' : 'text-gray-600 hover:text-gray-400'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="glass-panel p-5 border-l-2 border-red-500/30">
          <p className="text-red-400 text-sm">{error}</p>
          <p className="text-gray-600 text-xs mt-1">Make sure your Steam inventory privacy is set to Public.</p>
        </div>
      )}

      {/* Loading */}
      {loading && !inventory && (
        <div className="text-center py-16">
          <RefreshCw className="w-8 h-8 text-cyan-glow/40 mx-auto mb-3 animate-spin" />
          <p className="text-gray-500 text-sm">Loading your Steam inventory...</p>
        </div>
      )}

      {/* Items Grid */}
      {inventory && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filteredItems.map((item, idx) => (
            <div
              key={`${item.market_hash_name}-${idx}`}
              className="glass-panel p-3 hover:bg-white/[0.03] transition-all group cursor-default"
            >
              {/* Image */}
              <div className="relative aspect-square mb-2 rounded-lg bg-carbon-800/50 flex items-center justify-center overflow-hidden">
                {item.icon_url ? (
                  <img
                    src={item.icon_url}
                    alt={item.name}
                    className="w-full h-full object-contain p-2 group-hover:scale-110 transition-transform duration-300"
                    loading="lazy"
                  />
                ) : (
                  <Package className="w-8 h-8 text-gray-700" />
                )}
                {item.quantity > 1 && (
                  <span className="absolute top-1 right-1 bg-carbon-900/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                    x{item.quantity}
                  </span>
                )}
                {!item.tradable && (
                  <span className="absolute top-1 left-1 bg-red-500/20 text-red-400 text-[8px] font-bold px-1 py-0.5 rounded">
                    LOCKED
                  </span>
                )}
              </div>

              {/* Name */}
              <p
                className="text-[11px] font-medium truncate"
                style={{ color: item.name_color ? `#${item.name_color}` : '#e5e7eb' }}
                title={item.name}
              >
                {item.name}
              </p>

              {/* Rarity + Exterior */}
              <div className="flex items-center justify-between mt-1">
                {item.rarity && (
                  <span
                    className="text-[9px] font-mono truncate"
                    style={{ color: RARITY_COLORS[item.rarity] || '#6b7280' }}
                  >
                    {item.rarity}
                  </span>
                )}
                {item.exterior && (
                  <span className="text-[9px] text-gray-500 font-mono">
                    {item.exterior.replace('Factory New', 'FN').replace('Minimal Wear', 'MW').replace('Field-Tested', 'FT').replace('Well-Worn', 'WW').replace('Battle-Scarred', 'BS')}
                  </span>
                )}
              </div>

              {/* Price — main + per-market breakdown */}
              <div className="mt-2 pt-2 border-t border-white/[0.04]">
                {item.market_price ? (
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white font-mono">
                        ${item.market_price.toFixed(2)}
                      </span>
                      <a
                        href={`https://steamcommunity.com/market/listings/730/${encodeURIComponent(item.market_hash_name)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-glow/50 hover:text-cyan-glow transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    {/* Per-market prices */}
                    {(item as any).market_prices?.length > 0 && (
                      <div className="mt-1.5 space-y-0.5">
                        {(item as any).market_prices.map((mp: any, i: number) => (
                          <div key={i} className="flex justify-between">
                            <span className="text-[8px] text-gray-600 font-mono truncate">{mp.market}</span>
                            <span className="text-[8px] text-gray-400 font-mono">${mp.price.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-[10px] text-gray-600 font-mono">No price data</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {inventory && filteredItems.length === 0 && (
        <div className="text-center py-16">
          <Package className="w-8 h-8 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No items match this filter</p>
        </div>
      )}
    </div>
  );
};

export default Inventory;
