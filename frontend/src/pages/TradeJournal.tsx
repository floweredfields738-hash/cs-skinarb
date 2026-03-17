import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import {
  BookOpen, Plus, Trash2,
  Search, X, Lock, ShoppingCart, Tag, Download,
} from 'lucide-react';
import { exportTrades } from '../utils/csvExport';

interface Trade {
  id: number;
  skin_id: number;
  skin_name: string;
  weapon_name: string;
  rarity: string;
  trade_type: 'buy' | 'sell';
  quantity: number;
  price_per_unit: number;
  total_value: number;
  fee: number;
  net_value: number;
  market_name: string | null;
  notes: string | null;
  created_at: string;
}

interface Stats {
  totalTrades: number;
  buys: number;
  sells: number;
  totalSpent: number;
  totalEarned: number;
  totalFees: number;
  realizedPL: number;
  realizedPLPercent: number;
  winRate: number;
  profitableTrades: number;
  totalCompletedSkins: number;
}

const TradeJournal: React.FC = () => {
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  // Add form
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedSkin, setSelectedSkin] = useState<any>(null);
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [fee, setFee] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const token = localStorage.getItem('authToken');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchTrades = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/trades', { headers });
      const data = await res.json();
      if (data.success) {
        setTrades(data.trades || []);
        setStats(data.stats || null);
      }
    } catch {} finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchTrades(); }, [fetchTrades]);

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setSearchResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/skins/search?q=${encodeURIComponent(q)}&limit=8`);
        const data = await res.json();
        if (data.success) setSearchResults(data.data || []);
      } catch {}
    }, 300);
  };

  const logTrade = async () => {
    if (!selectedSkin || !price) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/trades', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          skinId: selectedSkin.id,
          tradeType,
          quantity: parseInt(quantity) || 1,
          pricePerUnit: parseFloat(price),
          fee: fee ? parseFloat(fee) : undefined,
          notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowAdd(false);
        setSelectedSkin(null);
        setSearchQuery('');
        setPrice('');
        setQuantity('1');
        setFee('');
        setNotes('');
        fetchTrades();
      }
    } catch {} finally { setSubmitting(false); }
  };

  const deleteTrade = async (id: number) => {
    await fetch(`/api/trades/${id}`, { method: 'DELETE', headers });
    fetchTrades();
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center glass-panel p-10 max-w-md">
          <Lock className="w-12 h-12 text-cyan-glow/30 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Sign In Required</h2>
          <p className="text-gray-500 text-sm mb-6">Sign in to track your trades and P&L.</p>
          <a href="/login" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-glow text-carbon-950 font-bold text-sm">Sign In</a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">Trade Journal</h1>
          <p className="text-sm text-gray-500 mt-1">Log trades and track your realized profit & loss</p>
        </div>
        <div className="flex items-center gap-2">
          {trades.length > 0 && (
            <button
              onClick={() => exportTrades(trades)}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-[11px] text-gray-500 hover:text-cyan-glow border border-white/[0.06] hover:border-cyan-glow/20 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
          )}
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-600 to-cyan-glow text-carbon-950 hover:shadow-glow-cyan transition-all"
          >
            <Plus className="w-4 h-4" />
            Log Trade
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <div className="glass-panel p-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-1">Realized P&L</p>
            <p className={`text-xl font-bold font-mono ${stats.realizedPL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {stats.realizedPL >= 0 ? '+' : ''}${stats.realizedPL.toFixed(2)}
            </p>
            <p className={`text-[10px] font-mono mt-0.5 ${stats.realizedPLPercent >= 0 ? 'text-emerald-400/60' : 'text-red-400/60'}`}>
              {stats.realizedPLPercent >= 0 ? '+' : ''}{stats.realizedPLPercent.toFixed(1)}%
            </p>
          </div>
          <div className="glass-panel p-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-1">Win Rate</p>
            <p className="text-xl font-bold text-cyan-glow">{stats.winRate}%</p>
            <p className="text-[10px] text-gray-600 font-mono mt-0.5">{stats.profitableTrades || 0} profitable</p>
          </div>
          <div className="glass-panel p-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-1">Total Spent</p>
            <p className="text-xl font-bold text-white font-mono">${stats.totalSpent.toFixed(2)}</p>
            <p className="text-[10px] text-gray-600 font-mono mt-0.5">{stats.buys} buys</p>
          </div>
          <div className="glass-panel p-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-1">Total Earned</p>
            <p className="text-xl font-bold text-emerald-400 font-mono">${stats.totalEarned.toFixed(2)}</p>
            <p className="text-[10px] text-gray-600 font-mono mt-0.5">{stats.sells} sells · ${stats.totalFees.toFixed(2)} fees</p>
          </div>
        </div>
      )}

      {/* Add Trade */}
      {showAdd && (
        <div className="glass-panel p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">Log a Trade</h3>
            <button onClick={() => setShowAdd(false)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
          </div>

          {!selectedSkin ? (
            <div>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text" value={searchQuery} onChange={e => handleSearch(e.target.value)}
                  placeholder="Search for a skin..." autoFocus
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-carbon-800/80 border border-white/[0.06] text-white text-sm focus:outline-none focus:border-cyan-glow/30"
                />
              </div>
              {searchResults.length > 0 && (
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {searchResults.map((s: any) => (
                    <button key={s.id} onClick={() => { setSelectedSkin(s); setSearchResults([]); }}
                      className="w-full text-left px-4 py-2.5 rounded-xl hover:bg-white/[0.04] transition-all flex justify-between">
                      <span className="text-sm text-white">{s.name}</span>
                      {s.current_price && <span className="text-sm text-gray-400 font-mono">${parseFloat(s.current_price).toFixed(2)}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4 px-4 py-3 rounded-xl bg-carbon-800/50 border border-white/[0.06]">
                <span className="text-sm text-white font-medium">{selectedSkin.name}</span>
                <button onClick={() => setSelectedSkin(null)} className="text-gray-500 hover:text-red-400 text-xs">Change</button>
              </div>

              {/* Buy/Sell toggle */}
              <div className="flex gap-2 mb-4">
                <button onClick={() => setTradeType('buy')}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                    tradeType === 'buy' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-carbon-800/50 text-gray-500 border border-white/[0.06]'
                  }`}>
                  <ShoppingCart className="w-4 h-4" /> Buy
                </button>
                <button onClick={() => setTradeType('sell')}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                    tradeType === 'sell' ? 'bg-cyan-glow/10 text-cyan-glow border border-cyan-glow/20' : 'bg-carbon-800/50 text-gray-500 border border-white/[0.06]'
                  }`}>
                  <Tag className="w-4 h-4" /> Sell
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-1">Price ($)</label>
                  <input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00"
                    className="w-full px-3 py-2.5 rounded-xl bg-carbon-800/80 border border-white/[0.06] text-white text-sm font-mono focus:outline-none focus:border-cyan-glow/30" />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-1">Qty</label>
                  <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} min="1"
                    className="w-full px-3 py-2.5 rounded-xl bg-carbon-800/80 border border-white/[0.06] text-white text-sm font-mono focus:outline-none focus:border-cyan-glow/30" />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-1">Fee ($)</label>
                  <input type="number" step="0.01" value={fee} onChange={e => setFee(e.target.value)} placeholder="auto"
                    className="w-full px-3 py-2.5 rounded-xl bg-carbon-800/80 border border-white/[0.06] text-white text-sm font-mono focus:outline-none focus:border-cyan-glow/30" />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-1">Notes (optional)</label>
                <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Good float, bought from Skinport"
                  className="w-full px-3 py-2.5 rounded-xl bg-carbon-800/80 border border-white/[0.06] text-white text-sm focus:outline-none focus:border-cyan-glow/30" />
              </div>

              <button onClick={logTrade} disabled={!price || submitting}
                className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-600 to-cyan-glow text-carbon-950 hover:shadow-glow-cyan transition-all disabled:opacity-40">
                {submitting ? 'Logging...' : `Log ${tradeType === 'buy' ? 'Buy' : 'Sell'}`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Trades List */}
      <div className="glass-panel overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.04]">
          <h3 className="text-sm font-bold text-white">Trade History</h3>
        </div>

        {loading ? (
          <div className="p-10 text-center">
            <BookOpen className="w-6 h-6 text-cyan-glow/30 mx-auto mb-2 animate-pulse" />
            <p className="text-gray-500 text-sm">Loading trades...</p>
          </div>
        ) : trades.length === 0 ? (
          <div className="p-10 text-center">
            <BookOpen className="w-8 h-8 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No trades logged yet</p>
            <p className="text-gray-600 text-xs mt-1">Log your buys and sells to track P&L</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left py-3 px-6 text-[10px] text-gray-500 uppercase tracking-widest font-mono">Type</th>
                  <th className="text-left py-3 px-4 text-[10px] text-gray-500 uppercase tracking-widest font-mono">Skin</th>
                  <th className="text-right py-3 px-4 text-[10px] text-gray-500 uppercase tracking-widest font-mono">Price</th>
                  <th className="text-right py-3 px-4 text-[10px] text-gray-500 uppercase tracking-widest font-mono">Qty</th>
                  <th className="text-right py-3 px-4 text-[10px] text-gray-500 uppercase tracking-widest font-mono">Fee</th>
                  <th className="text-right py-3 px-4 text-[10px] text-gray-500 uppercase tracking-widest font-mono">Net</th>
                  <th className="text-left py-3 px-4 text-[10px] text-gray-500 uppercase tracking-widest font-mono">Market</th>
                  <th className="text-left py-3 px-4 text-[10px] text-gray-500 uppercase tracking-widest font-mono">Date</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {trades.map(t => (
                  <tr key={t.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-all">
                    <td className="py-3 px-6">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 rounded ${
                        t.trade_type === 'buy'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-cyan-glow/10 text-cyan-glow border border-cyan-glow/20'
                      }`}>
                        {t.trade_type === 'buy' ? <ShoppingCart className="w-3 h-3" /> : <Tag className="w-3 h-3" />}
                        {t.trade_type}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-white font-medium text-[13px]">{t.skin_name}</p>
                      {t.notes && <p className="text-[10px] text-gray-600 mt-0.5">{t.notes}</p>}
                    </td>
                    <td className="py-3 px-4 text-right text-white font-mono">${parseFloat(String(t.price_per_unit)).toFixed(2)}</td>
                    <td className="py-3 px-4 text-right text-gray-400 font-mono">{t.quantity}</td>
                    <td className="py-3 px-4 text-right text-gray-500 font-mono">${parseFloat(String(t.fee)).toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold">
                      <span className={t.trade_type === 'sell' ? 'text-emerald-400' : 'text-red-400'}>
                        {t.trade_type === 'sell' ? '+' : '-'}${parseFloat(String(t.net_value)).toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-[11px]">{t.market_name || '—'}</td>
                    <td className="py-3 px-4 text-gray-600 text-[11px] font-mono">{new Date(t.created_at).toLocaleDateString()}</td>
                    <td className="py-3 px-4">
                      <button onClick={() => deleteTrade(t.id)} className="text-gray-700 hover:text-red-400 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TradeJournal;
