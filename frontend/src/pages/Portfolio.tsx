import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Wallet, TrendingUp, Plus, Trash2, Search,
  ArrowUpRight, ArrowDownRight, Package,
} from 'lucide-react';
import { portfolioApi, marketApi } from '../api/services';
import { useConnectionStatus } from '../hooks/useRealTimeData';
import AnimatedNumber from '../components/common/AnimatedNumber';

const RARITY_COLORS: Record<string, string> = {
  Covert: '#eb4b4b', Classified: '#d32ee6', Restricted: '#8847ff',
  'Mil-Spec': '#4b69ff', 'Industrial Grade': '#5e98d9', 'Consumer Grade': '#b0c3d9',
  Extraordinary: '#e4ae39',
};

interface Holding {
  id: number;
  skin_id: number;
  name: string;
  rarity: string;
  quantity: number;
  purchase_price: number;
  market_price: number | null;
  total_cost: number;
  total_value: number | null;
  profit_loss: number | null;
  profit_percent: number | null;
  condition: string | null;
  min_float: number;
  max_float: number;
  added_at: string;
}

interface PortfolioSummary {
  totalInvested: number;
  totalValue: number;
  profitLoss: number;
  profitPercent: number;
  itemCount: number;
}

const Portfolio: React.FC = () => {
  const connected = useConnectionStatus();
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);

  // Add item state
  const [showAdd, setShowAdd] = useState(false);
  const [addQuery, setAddQuery] = useState('');
  const [addResults, setAddResults] = useState<any[]>([]);
  const [selectedSkin, setSelectedSkin] = useState<any>(null);
  const [buyPrice, setBuyPrice] = useState('');
  const [buyQty, setBuyQty] = useState('1');
  const addDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPortfolio = useCallback(() => {
    portfolioApi.get()
      .then(res => {
        if (res.data?.success) {
          setPortfolio(res.data.portfolio);
          setHoldings(res.data.holdings || []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchPortfolio();
    const interval = setInterval(fetchPortfolio, 30000);
    return () => clearInterval(interval);
  }, [fetchPortfolio]);

  // Search skins to add
  const handleSearch = useCallback((q: string) => {
    setAddQuery(q);
    if (addDebounceRef.current) clearTimeout(addDebounceRef.current);
    if (q.length < 2) { setAddResults([]); return; }
    addDebounceRef.current = setTimeout(() => {
      marketApi.searchSkins(q, 10)
        .then(res => setAddResults(res.data?.data || []))
        .catch(() => setAddResults([]));
    }, 300);
  }, []);

  // Add holding
  const handleAdd = async () => {
    if (!selectedSkin || !buyPrice) return;
    try {
      await portfolioApi.addItem({
        skin_id: String(selectedSkin.id),
        purchase_price: parseFloat(buyPrice),
        quantity: parseInt(buyQty) || 1,
      });
      setShowAdd(false);
      setSelectedSkin(null);
      setBuyPrice('');
      setBuyQty('1');
      setAddQuery('');
      fetchPortfolio();
    } catch {}
  };

  // Remove holding
  const handleRemove = async (itemId: number) => {
    try {
      await portfolioApi.removeItem(String(itemId));
      setHoldings(prev => prev.filter(h => h.id !== itemId));
    } catch {}
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-[1600px] mx-auto fade-in">
        <div className="flex items-center gap-3">
          <Wallet className="w-5 h-5 text-cyan-glow" />
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">Portfolio</h1>
        </div>
        <div className="glass-panel p-12 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-cyan-glow/30 border-t-cyan-glow rounded-full animate-spin" />
          <span className="ml-3 text-sm text-gray-500 font-mono">Loading portfolio...</span>
        </div>
      </div>
    );
  }

  const isProfit = (portfolio?.profitLoss || 0) >= 0;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Wallet className="w-5 h-5 text-cyan-glow" />
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">Portfolio</h1>
          </div>
          <p className="text-sm text-gray-500">
            Track your investments and P&L
            {connected && (
              <span className="ml-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-glow animate-pulse mr-1" />
                <span className="text-cyan-glow/60 text-[11px] font-mono">Live</span>
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-glow/10 border border-cyan-glow/20 text-cyan-glow text-[12px] font-bold hover:bg-cyan-glow/20 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Holding
        </button>
      </div>

      {/* Add holding form */}
      {showAdd && (
        <div className="glass-panel p-5">
          <h3 className="text-sm font-bold text-white mb-3">Add a holding</h3>

          {!selectedSkin ? (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={addQuery}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Search skin name..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-carbon-900/60 border border-white/[0.06] text-sm text-white placeholder-gray-600 font-mono focus:outline-none focus:border-cyan-glow/30"
                autoFocus
              />
              {addResults.length > 0 && (
                <div className="mt-2 rounded-xl bg-carbon-800/95 border border-white/[0.08] max-h-60 overflow-y-auto">
                  {addResults.map((skin: any) => (
                    <button
                      key={skin.id}
                      onClick={() => { setSelectedSkin(skin); setAddResults([]); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.04] border-b border-white/[0.03] last:border-b-0"
                    >
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: RARITY_COLORS[skin.rarity] || '#888' }} />
                      <span className="text-[13px] text-white flex-1">{skin.name}</span>
                      {skin.current_price && (
                        <span className="text-[11px] font-mono text-gray-400">${parseFloat(skin.current_price).toFixed(2)}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-carbon-900/40 border border-white/[0.06]">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: RARITY_COLORS[selectedSkin.rarity] || '#888' }} />
                <span className="text-sm text-white font-medium flex-1">{selectedSkin.name}</span>
                <button onClick={() => setSelectedSkin(null)} className="text-[10px] text-gray-500 hover:text-white">Change</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Buy Price ($)</label>
                  <input
                    type="number"
                    value={buyPrice}
                    onChange={e => setBuyPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 rounded-lg bg-carbon-900/60 border border-white/[0.06] text-sm text-white font-mono focus:outline-none focus:border-cyan-glow/30"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Quantity</label>
                  <input
                    type="number"
                    value={buyQty}
                    onChange={e => setBuyQty(e.target.value)}
                    min="1"
                    className="w-full px-3 py-2 rounded-lg bg-carbon-900/60 border border-white/[0.06] text-sm text-white font-mono focus:outline-none focus:border-cyan-glow/30"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  disabled={!buyPrice}
                  className="px-4 py-2 rounded-lg bg-cyan-glow/15 border border-cyan-glow/30 text-cyan-glow text-[12px] font-bold hover:bg-cyan-glow/25 transition-all disabled:opacity-40"
                >
                  Add to Portfolio
                </button>
                <button
                  onClick={() => { setShowAdd(false); setSelectedSkin(null); }}
                  className="px-4 py-2 rounded-lg text-gray-500 text-[12px] hover:text-white transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Summary cards */}
      {portfolio && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="glass-panel p-5">
            <p className="text-[11px] text-gray-500 uppercase tracking-wider">Total Value</p>
            <AnimatedNumber value={portfolio.totalValue} prefix="$" decimals={2} duration={500}
              className="text-2xl font-bold text-white font-mono mt-2" />
          </div>
          <div className="glass-panel p-5">
            <p className="text-[11px] text-gray-500 uppercase tracking-wider">Total Invested</p>
            <AnimatedNumber value={portfolio.totalInvested} prefix="$" decimals={2} duration={500}
              className="text-2xl font-bold text-white font-mono mt-2" />
          </div>
          <div className="glass-panel p-5">
            <p className="text-[11px] text-gray-500 uppercase tracking-wider">Profit / Loss</p>
            <div className="flex items-center gap-2 mt-2">
              <AnimatedNumber value={Math.abs(portfolio.profitLoss)} prefix={isProfit ? '+$' : '-$'} decimals={2} duration={500}
                className={`text-2xl font-bold font-mono ${isProfit ? 'text-emerald-400' : 'text-red-400'}`} />
            </div>
            <span className={`text-[11px] font-mono font-bold ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
              {isProfit ? '+' : ''}{portfolio.profitPercent.toFixed(1)}%
            </span>
          </div>
          <div className="glass-panel p-5">
            <p className="text-[11px] text-gray-500 uppercase tracking-wider">Holdings</p>
            <p className="text-2xl font-bold text-white font-mono mt-2">{portfolio.itemCount}</p>
          </div>
        </div>
      )}

      {/* Holdings table */}
      {holdings.length === 0 ? (
        <div className="glass-panel p-12 text-center">
          <Package className="w-10 h-10 text-cyan-glow/30 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white mb-2">No holdings yet</h3>
          <p className="text-sm text-gray-500 mb-4">Add skins you've purchased to track your profit and loss.</p>
          <button
            onClick={() => setShowAdd(true)}
            className="px-5 py-2.5 rounded-xl bg-cyan-glow/10 border border-cyan-glow/20 text-cyan-glow text-[13px] font-bold"
          >
            <Plus className="w-4 h-4 inline mr-2" />
            Add Your First Holding
          </button>
        </div>
      ) : (
        <div className="glass-panel overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left text-[10px] text-gray-500 uppercase tracking-wider font-mono py-3 px-5">Skin</th>
                <th className="text-right text-[10px] text-gray-500 uppercase tracking-wider font-mono py-3 px-4">Qty</th>
                <th className="text-right text-[10px] text-gray-500 uppercase tracking-wider font-mono py-3 px-4">Buy Price</th>
                <th className="text-right text-[10px] text-gray-500 uppercase tracking-wider font-mono py-3 px-4">Market Price</th>
                <th className="text-right text-[10px] text-gray-500 uppercase tracking-wider font-mono py-3 px-4">P&L</th>
                <th className="text-right text-[10px] text-gray-500 uppercase tracking-wider font-mono py-3 px-4">P&L %</th>
                <th className="text-right text-[10px] text-gray-500 uppercase tracking-wider font-mono py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {holdings.map(h => {
                const rarityColor = RARITY_COLORS[h.rarity] || '#6b7280';
                const isProfitable = (h.profit_loss || 0) >= 0;

                return (
                  <tr key={h.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors group">
                    <td className="py-3 px-5">
                      <Link to={`/skins/${h.skin_id}`} className="flex items-center gap-3 hover:text-cyan-glow transition-colors">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: rarityColor }} />
                        <div>
                          <p className="text-[13px] text-white font-medium">{h.name}</p>
                          <p className="text-[10px] text-gray-600 font-mono">
                            Float {h.min_float.toFixed(2)}-{h.max_float.toFixed(2)}
                            {h.condition && ` · ${h.condition}`}
                          </p>
                        </div>
                      </Link>
                    </td>
                    <td className="text-right py-3 px-4 text-[13px] font-mono text-gray-300">{h.quantity}</td>
                    <td className="text-right py-3 px-4 text-[13px] font-mono text-gray-300">${h.purchase_price.toFixed(2)}</td>
                    <td className="text-right py-3 px-4 text-[13px] font-mono text-white">
                      {h.market_price !== null ? (
                        <AnimatedNumber value={h.market_price} prefix="$" decimals={2} duration={500} />
                      ) : '—'}
                    </td>
                    <td className="text-right py-3 px-4">
                      {h.profit_loss !== null ? (
                        <span className={`text-[13px] font-mono font-bold flex items-center justify-end gap-1 ${isProfitable ? 'text-emerald-400' : 'text-red-400'}`}>
                          {isProfitable ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          ${Math.abs(h.profit_loss).toFixed(2)}
                        </span>
                      ) : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="text-right py-3 px-4">
                      {h.profit_percent !== null ? (
                        <span className={`text-[12px] font-mono font-bold px-2 py-0.5 rounded ${
                          isProfitable ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                        }`}>
                          {isProfitable ? '+' : ''}{h.profit_percent.toFixed(1)}%
                        </span>
                      ) : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="text-right py-3 px-4">
                      <button
                        onClick={() => handleRemove(h.id)}
                        className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-center gap-2 pb-4">
        <TrendingUp className="w-3 h-3 text-gray-600" />
        <span className="text-[10px] text-gray-600 font-mono">
          Market prices update every 30s — P&L calculated from real market data
        </span>
      </div>
    </div>
  );
};

export default Portfolio;
