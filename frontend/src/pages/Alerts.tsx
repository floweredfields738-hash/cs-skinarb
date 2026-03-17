import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import {
  Bell, BellRing, Plus, Pause, Play, Trash2,
  TrendingUp, TrendingDown, ArrowRightLeft, X, Search, Lock,
} from 'lucide-react';

interface Alert {
  id: number;
  skin_id: number;
  skin_name: string;
  alert_type: string;
  trigger_condition: string;
  trigger_value: number;
  is_active: boolean;
  last_triggered: string | null;
  trigger_count: number;
  current_price: number | null;
  created_at: string;
}

const alertTypeIcon = (type: string) => {
  if (type === 'price_above') return <TrendingUp className="w-3.5 h-3.5" />;
  if (type === 'price_below') return <TrendingDown className="w-3.5 h-3.5" />;
  if (type === 'arbitrage_found') return <ArrowRightLeft className="w-3.5 h-3.5" />;
  return <Bell className="w-3.5 h-3.5" />;
};

const alertTypeLabel = (type: string) => {
  if (type === 'price_above') return 'Price Above';
  if (type === 'price_below') return 'Price Below';
  if (type === 'arbitrage_found') return 'Arbitrage Found';
  if (type === 'volume_spike') return 'Volume Spike';
  return type;
};

const Alerts: React.FC = () => {
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Create form
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedSkin, setSelectedSkin] = useState<any>(null);
  const [alertType, setAlertType] = useState('price_below');
  const [alertValue, setAlertValue] = useState('');
  const [creating, setCreating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchAlerts = useCallback(async () => {
    const t = localStorage.getItem('authToken');
    if (!t) { setLoading(false); return; }
    const h = { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' };
    try {
      const [alertsRes, statsRes] = await Promise.all([
        fetch('/api/alerts', { headers: h }),
        fetch('/api/alerts/stats', { headers: h }),
      ]);
      const alertsData = await alertsRes.json();
      const statsData = await statsRes.json();
      if (alertsData.success) setAlerts(alertsData.data || []);
      if (statsData.success) setStats(statsData.data);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  // Search skins
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

  const createAlert = async () => {
    if (!selectedSkin || !alertValue) return;
    setCreating(true);
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skinId: selectedSkin.id,
          alertType,
          condition: alertType.includes('above') ? 'above' : 'below',
          value: parseFloat(alertValue),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowCreate(false);
        setSelectedSkin(null);
        setSearchQuery('');
        setAlertValue('');
        fetchAlerts();
      }
    } catch {} finally { setCreating(false); }
  };

  const toggleAlert = async (id: number) => {
    await fetch(`/api/alerts/${id}/toggle`, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}`, 'Content-Type': 'application/json' } });
    fetchAlerts();
  };

  const deleteAlert = async (id: number) => {
    await fetch(`/api/alerts/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` } });
    fetchAlerts();
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center glass-panel p-10 max-w-md">
          <Lock className="w-12 h-12 text-cyan-glow/30 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Sign In Required</h2>
          <p className="text-gray-500 text-sm mb-6">Sign in to create and manage price alerts.</p>
          <a href="/login" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-glow text-carbon-950 font-bold text-sm hover:shadow-glow-cyan transition-all">
            Sign In
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">Price Alerts</h1>
          <p className="text-sm text-gray-500 mt-1">Get notified when skins hit your target price</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-600 to-cyan-glow text-carbon-950 hover:shadow-glow-cyan transition-all"
        >
          <Plus className="w-4 h-4" />
          New Alert
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="glass-panel p-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-1">Active</p>
          <p className="text-xl font-bold text-cyan-glow">{stats?.active || 0}</p>
        </div>
        <div className="glass-panel p-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-1">Triggered</p>
          <p className="text-xl font-bold text-emerald-400">{stats?.triggered || 0}</p>
        </div>
        <div className="glass-panel p-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-1">Paused</p>
          <p className="text-xl font-bold text-yellow-400">{stats?.paused || 0}</p>
        </div>
        <div className="glass-panel p-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-1">Total</p>
          <p className="text-xl font-bold text-white">{stats?.total || 0}</p>
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="glass-panel p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">Create Alert</h3>
            <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
          </div>

          {/* Skin search */}
          {!selectedSkin ? (
            <div>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => handleSearch(e.target.value)}
                  placeholder="Search for a skin..."
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-carbon-800/80 border border-white/[0.06] text-white text-sm focus:outline-none focus:border-cyan-glow/30"
                />
              </div>
              {searchResults.length > 0 && (
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {searchResults.map((s: any) => (
                    <button
                      key={s.id}
                      onClick={() => { setSelectedSkin(s); setSearchResults([]); }}
                      className="w-full text-left px-4 py-2.5 rounded-xl hover:bg-white/[0.04] transition-all flex justify-between"
                    >
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

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-2">Alert Type</label>
                  <select
                    value={alertType}
                    onChange={e => setAlertType(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-carbon-800/80 border border-white/[0.06] text-white text-sm focus:outline-none"
                  >
                    <option value="price_below">Price Below</option>
                    <option value="price_above">Price Above</option>
                    <option value="arbitrage_found">Arbitrage Found</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-2">
                    {alertType === 'arbitrage_found' ? 'Min Profit ($)' : 'Target Price ($)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={alertValue}
                    onChange={e => setAlertValue(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-3 rounded-xl bg-carbon-800/80 border border-white/[0.06] text-white text-sm font-mono focus:outline-none focus:border-cyan-glow/30"
                  />
                </div>
              </div>

              <button
                onClick={createAlert}
                disabled={!alertValue || creating}
                className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-600 to-cyan-glow text-carbon-950 hover:shadow-glow-cyan transition-all disabled:opacity-40"
              >
                {creating ? 'Creating...' : 'Create Alert'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Alerts List */}
      <div className="glass-panel overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.04]">
          <h3 className="text-sm font-bold text-white">Your Alerts</h3>
        </div>

        {loading ? (
          <div className="p-10 text-center">
            <Bell className="w-6 h-6 text-cyan-glow/30 mx-auto mb-2 animate-pulse" />
            <p className="text-gray-500 text-sm">Loading alerts...</p>
          </div>
        ) : alerts.length === 0 ? (
          <div className="p-10 text-center">
            <BellRing className="w-8 h-8 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No alerts yet</p>
            <p className="text-gray-600 text-xs mt-1">Create one to get notified when prices hit your targets</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {alerts.map(alert => (
              <div key={alert.id} className="px-6 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-all">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className={`p-2 rounded-lg ${alert.is_active ? 'bg-cyan-glow/10 text-cyan-glow' : 'bg-gray-800 text-gray-600'}`}>
                    {alertTypeIcon(alert.alert_type)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-white font-medium truncate">{alert.skin_name}</p>
                    <p className="text-[11px] text-gray-500 font-mono">
                      {alertTypeLabel(alert.alert_type)}: ${Number(alert.trigger_value).toFixed(2)}
                      {alert.current_price && (
                        <span className="text-gray-600 ml-2">
                          (now ${parseFloat(String(alert.current_price)).toFixed(2)})
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  {alert.last_triggered && (
                    <span className="text-[9px] text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded font-bold uppercase">
                      Triggered
                    </span>
                  )}
                  {!alert.is_active && !alert.last_triggered && (
                    <span className="text-[9px] text-yellow-400 bg-yellow-500/10 px-2 py-1 rounded font-bold uppercase">
                      Paused
                    </span>
                  )}
                  <button
                    onClick={() => toggleAlert(alert.id)}
                    className="p-1.5 rounded-lg hover:bg-white/[0.06] text-gray-500 hover:text-white transition-all"
                    title={alert.is_active ? 'Pause' : 'Resume'}
                  >
                    {alert.is_active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => deleteAlert(alert.id)}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-all"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Alerts;
