import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  Monitor,
  X,
} from 'lucide-react';
import { marketApi } from '../api/services';
import CandlestickChart from '../components/dashboard/CandlestickChart';
import CrossMarketComparison from '../components/dashboard/CrossMarketComparison';
import { useConnectionStatus } from '../hooks/useRealTimeData';

// ── Types ────────────────────────────────────────────────────────────────────

interface SkinResult {
  id: number;
  name: string;
  weapon_name: string;
  skin_name: string;
  rarity: string;
  current_price: number | string | null;
}

const RARITY_COLORS: Record<string, string> = {
  Covert: '#eb4b4b',
  Classified: '#d32ce6',
  Restricted: '#8847ff',
  'Mil-Spec': '#4b69ff',
  Industrial: '#5e98d9',
  Consumer: '#b0c3d9',
  Extraordinary: '#e4ae39',
};

function clsx(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

// ── Default: Full Market Index Candlestick Chart ─────────────────────────────

const MarketOverviewChart: React.FC<{ onSearchHint: (q: string) => void }> = ({ onSearchHint }) => {
  return (
    <div className="space-y-4">
      {/* Full-screen market index candlestick chart */}
      <div className="h-[calc(100vh-280px)] min-h-[550px]">
        <CandlestickChart
          skinId={0}
          marketId={0}
          skinName="CS2 Market Index — All Markets"
          height={0}
          showIntervalSelector={true}
          showVolume={true}
          className="h-full"
          indexMode={true}
        />
      </div>

      {/* Quick search hints */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <span className="text-[10px] text-gray-600 font-mono">Search a skin for detailed cross-market analysis:</span>
        {['AK-47 Redline', 'AWP Dragon Lore', 'Karambit Fade', 'M4A4 Howl', 'Butterfly Knife'].map((hint) => (
          <button
            key={hint}
            onClick={() => onSearchHint(hint)}
            className="px-3 py-1.5 rounded-lg text-[10px] font-mono text-gray-400 bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:text-gray-300 transition-all"
          >
            {hint}
          </button>
        ))}
      </div>
    </div>
  );
};

// ── Component ────────────────────────────────────────────────────────────────

const MarketMonitor: React.FC = () => {
  const isConnected = useConnectionStatus();

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SkinResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Selected skins for comparison
  const [selectedSkins, setSelectedSkins] = useState<SkinResult[]>([]);

  // Click outside to close search
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Debounced search
  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (q.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setSearchLoading(true);
    debounceRef.current = setTimeout(() => {
      marketApi.searchSkins(q, 15)
        .then((res) => {
          const data = res.data?.data || res.data || [];
          setSearchResults(Array.isArray(data) ? data : []);
          setShowResults(true);
        })
        .catch(() => setSearchResults([]))
        .finally(() => setSearchLoading(false));
    }, 300);
  }, []);

  const addSkin = useCallback((skin: SkinResult) => {
    setSelectedSkins((prev) => {
      if (prev.find((s) => s.id === skin.id)) return prev;
      return [...prev, skin];
    });
    setShowResults(false);
    setSearchQuery('');
  }, []);

  const removeSkin = useCallback((skinId: number) => {
    setSelectedSkins((prev) => prev.filter((s) => s.id !== skinId));
  }, []);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-glow/[0.08] border border-cyan-glow/10">
            <Monitor className="w-5 h-5 text-cyan-glow" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">Market Monitor</h1>
            <p className="text-[11px] text-gray-500 font-mono mt-0.5">
              Cross-market candlestick analysis &bull; Search any skin
            </p>
          </div>
          {isConnected && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 ml-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400">Live</span>
            </span>
          )}
        </div>
      </div>

      {/* Search bar */}
      <div className="glass-panel p-4 relative z-30" ref={searchRef}>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => searchResults.length > 0 && setShowResults(true)}
            placeholder="Search skins to add to monitor (e.g. AK-47, Dragon Lore, Butterfly)..."
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-carbon-900/60 border border-white/[0.06] text-sm text-white placeholder-gray-600 font-mono focus:outline-none focus:border-cyan-glow/30 focus:bg-carbon-900/80 transition-all"
          />
          {searchLoading && (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-cyan-glow/30 border-t-cyan-glow rounded-full animate-spin" />
            </div>
          )}

          {/* Search results dropdown */}
          {showResults && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 rounded-xl bg-carbon-800/95 backdrop-blur-xl border border-white/[0.08] shadow-2xl z-50 max-h-80 overflow-y-auto">
              {searchResults.map((skin) => {
                const rarityColor = RARITY_COLORS[skin.rarity] || '#6b7280';
                const alreadyAdded = selectedSkins.some((s) => s.id === skin.id);
                const price = skin.current_price ? parseFloat(String(skin.current_price)) : null;

                return (
                  <button
                    key={skin.id}
                    onClick={() => !alreadyAdded && addSkin(skin)}
                    disabled={alreadyAdded}
                    className={clsx(
                      'w-full flex items-center gap-3 px-4 py-3 text-left transition-all border-b border-white/[0.03] last:border-b-0',
                      alreadyAdded
                        ? 'opacity-40 cursor-not-allowed'
                        : 'hover:bg-white/[0.04] cursor-pointer'
                    )}
                  >
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: rarityColor, boxShadow: `0 0 6px ${rarityColor}60` }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-white font-medium truncate">{skin.name}</div>
                      <div className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">{skin.rarity}</div>
                    </div>
                    {price !== null && (
                      <span className="text-[12px] font-mono text-gray-300 flex-shrink-0">
                        ${price.toFixed(2)}
                      </span>
                    )}
                    {alreadyAdded && (
                      <span className="text-[10px] text-cyan-glow font-mono">Added</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected skin tags */}
        {selectedSkins.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {selectedSkins.map((skin) => {
              const rarityColor = RARITY_COLORS[skin.rarity] || '#6b7280';
              return (
                <span
                  key={skin.id}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-mono"
                  style={{
                    backgroundColor: `${rarityColor}15`,
                    color: rarityColor,
                    border: `1px solid ${rarityColor}30`,
                  }}
                >
                  {skin.weapon_name} | {skin.skin_name}
                  <button
                    onClick={() => removeSkin(skin.id)}
                    className="hover:opacity-70 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Charts grid */}
      {selectedSkins.length === 0 ? (
        <MarketOverviewChart onSearchHint={handleSearch} />
      ) : (
        <div className="space-y-6">
          {selectedSkins.map((skin) => {
            const price = skin.current_price ? parseFloat(String(skin.current_price)) : null;

            return (
              <div key={skin.id} className="space-y-2">
                {/* Skin header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{
                        backgroundColor: RARITY_COLORS[skin.rarity] || '#6b7280',
                        boxShadow: `0 0 8px ${RARITY_COLORS[skin.rarity] || '#6b7280'}60`,
                      }}
                    />
                    <h3 className="text-base font-bold text-white">{skin.name}</h3>
                    {price !== null && (
                      <span className="text-[12px] font-mono text-gray-400">${price.toFixed(2)}</span>
                    )}
                    <span className="text-[11px] text-gray-500 font-mono">All markets</span>
                  </div>

                  <button
                    onClick={() => removeSkin(skin.id)}
                    className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Cross-market price comparison */}
                <CrossMarketComparison skinId={skin.id} skinName={skin.name} />

                {/* Candlestick chart — shows primary market candles + all other markets as overlays */}
                <div className="h-[calc(100vh-320px)] min-h-[500px]">
                  <CandlestickChart
                    skinId={skin.id}
                    marketId={3}
                    skinName={skin.name}
                    height={0}
                    showIntervalSelector={true}
                    showVolume={true}
                    className="h-full"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MarketMonitor;
