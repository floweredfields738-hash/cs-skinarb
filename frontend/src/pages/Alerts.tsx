import React, { useState } from 'react';
import {
  Bell,
  BellRing,
  Plus,
  Pause,
  Play,
  Trash2,
  Zap,
  Clock,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  BarChart3,
  ArrowRightLeft,
  X,
  FlaskConical,
  Activity,
  Shield,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────
type AlertType = 'Price Above' | 'Price Below' | 'Volume Spike' | 'Arbitrage Found';
type AlertStatus = 'Active' | 'Paused';

interface ActiveAlert {
  id: number;
  skin: string;
  type: AlertType;
  threshold: number;
  status: AlertStatus;
  createdAt: string;
}

interface TriggeredAlert {
  id: number;
  skin: string;
  type: AlertType;
  triggeredAt: string;
  triggeredValue: string;
  acknowledged: boolean;
}

// ── Mock Data ──────────────────────────────────────────────────────────────────
const initialActiveAlerts: ActiveAlert[] = [
  { id: 1, skin: 'AK-47 | Asiimov (Field-Tested)', type: 'Price Above', threshold: 150, status: 'Active', createdAt: '2026-03-10' },
  { id: 2, skin: 'AWP | Dragon Lore (Minimal Wear)', type: 'Price Below', threshold: 4800, status: 'Active', createdAt: '2026-03-08' },
  { id: 3, skin: 'M4A4 | Howl (Factory New)', type: 'Volume Spike', threshold: 200, status: 'Paused', createdAt: '2026-03-05' },
  { id: 4, skin: 'Butterfly Knife | Fade (FN)', type: 'Arbitrage Found', threshold: 50, status: 'Active', createdAt: '2026-03-12' },
  { id: 5, skin: 'Glock-18 | Fade (Factory New)', type: 'Price Above', threshold: 320, status: 'Active', createdAt: '2026-03-13' },
  { id: 6, skin: 'Sport Gloves | Pandora\'s Box (MW)', type: 'Price Below', threshold: 8500, status: 'Paused', createdAt: '2026-03-01' },
];

const triggeredAlerts: TriggeredAlert[] = [
  { id: 1, skin: 'AK-47 | Asiimov (Field-Tested)', type: 'Price Above', triggeredAt: '2026-03-14 09:32:14', triggeredValue: '$154.20', acknowledged: true },
  { id: 2, skin: 'Butterfly Knife | Fade (FN)', type: 'Arbitrage Found', triggeredAt: '2026-03-13 22:15:47', triggeredValue: '$62.40 spread', acknowledged: true },
  { id: 3, skin: 'Glock-18 | Fade (Factory New)', type: 'Price Above', triggeredAt: '2026-03-13 18:04:33', triggeredValue: '$328.00', acknowledged: false },
  { id: 4, skin: 'AWP | Dragon Lore (Minimal Wear)', type: 'Price Below', triggeredAt: '2026-03-12 14:20:09', triggeredValue: '$4,750.00', acknowledged: true },
  { id: 5, skin: 'M4A4 | Howl (Factory New)', type: 'Volume Spike', triggeredAt: '2026-03-11 06:58:22', triggeredValue: '247% increase', acknowledged: true },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
const alertTypeIcon = (type: AlertType) => {
  switch (type) {
    case 'Price Above': return <TrendingUp className="w-3.5 h-3.5" />;
    case 'Price Below': return <TrendingDown className="w-3.5 h-3.5" />;
    case 'Volume Spike': return <BarChart3 className="w-3.5 h-3.5" />;
    case 'Arbitrage Found': return <ArrowRightLeft className="w-3.5 h-3.5" />;
  }
};

const conditionLabel = (alert: ActiveAlert) => {
  switch (alert.type) {
    case 'Price Above': return `Price > $${alert.threshold.toLocaleString()}`;
    case 'Price Below': return `Price < $${alert.threshold.toLocaleString()}`;
    case 'Volume Spike': return `Volume > ${alert.threshold}%`;
    case 'Arbitrage Found': return `Spread > $${alert.threshold}`;
  }
};

// ── Component ──────────────────────────────────────────────────────────────────
const Alerts: React.FC = () => {
  const [activeAlerts, setActiveAlerts] = useState<ActiveAlert[]>(initialActiveAlerts);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Create-form state
  const [newSkin, setNewSkin] = useState('');
  const [newType, setNewType] = useState<AlertType>('Price Above');
  const [newThreshold, setNewThreshold] = useState('');
  const [newEnabled, setNewEnabled] = useState(true);

  const stats = [
    { label: 'Active Alerts', value: activeAlerts.filter(a => a.status === 'Active').length.toString(), icon: <Bell className="w-5 h-5" />, accent: 'cyan' },
    { label: 'Triggered Today', value: '3', icon: <BellRing className="w-5 h-5" />, accent: 'gold' },
    { label: 'Avg Response Time', value: '1.4s', icon: <Clock className="w-5 h-5" />, accent: 'cyan' },
    { label: 'Success Rate', value: '98.2%', icon: <CheckCircle2 className="w-5 h-5" />, accent: 'cyan' },
  ];

  const toggleStatus = (id: number) => {
    setActiveAlerts(prev =>
      prev.map(a => a.id === id ? { ...a, status: a.status === 'Active' ? 'Paused' : 'Active' } : a)
    );
  };

  const deleteAlert = (id: number) => {
    setActiveAlerts(prev => prev.filter(a => a.id !== id));
  };

  const handleCreate = () => {
    if (!newSkin.trim() || !newThreshold.trim()) return;
    const next: ActiveAlert = {
      id: Date.now(),
      skin: newSkin,
      type: newType,
      threshold: parseFloat(newThreshold),
      status: newEnabled ? 'Active' : 'Paused',
      createdAt: new Date().toISOString().slice(0, 10),
    };
    setActiveAlerts(prev => [next, ...prev]);
    setNewSkin('');
    setNewType('Price Above');
    setNewThreshold('');
    setNewEnabled(true);
    setShowCreateModal(false);
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto fade-in">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Alert Management</h1>
          <p className="text-sm text-gray-500 mt-1">Monitor price movements and market opportunities</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="neon-dot"></div>
            <span className="text-[11px] text-gray-500 font-mono">Monitoring active</span>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 bg-gradient-to-r from-cyan-600 to-cyan-glow text-carbon-950 hover:shadow-glow-cyan"
          >
            <Plus className="w-4 h-4" />
            Create Alert
          </button>
        </div>
      </div>

      {/* ── Stats Bar ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="glass-panel-hover p-5 group">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">{stat.label}</p>
                <h3 className="text-2xl font-bold text-white mt-2 font-mono tracking-tight">{stat.value}</h3>
              </div>
              <div className={`p-2.5 rounded-xl transition-all duration-300 ${
                stat.accent === 'gold'
                  ? 'bg-gold-400/[0.08] text-gold-400/70 group-hover:bg-gold-400/[0.12] group-hover:text-gold-400'
                  : 'bg-cyan-glow/[0.06] text-cyan-glow/60 group-hover:bg-cyan-glow/10 group-hover:text-cyan-glow'
              }`}>
                {stat.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Create Alert Modal ──────────────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-carbon-950/80 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />

          <div className="glass-panel p-8 w-full max-w-lg relative z-10 slide-up">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Create New Alert</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-gray-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5">
              {/* Skin Name */}
              <div>
                <label className="block text-[11px] text-gray-500 uppercase tracking-wider font-medium mb-2">Skin Name</label>
                <input
                  value={newSkin}
                  onChange={e => setNewSkin(e.target.value)}
                  placeholder="e.g. AK-47 | Redline (Field-Tested)"
                  className="w-full px-4 py-3 rounded-xl bg-carbon-800/80 border border-white/[0.06] text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-glow/30 focus:ring-1 focus:ring-cyan-glow/20 transition-all"
                />
              </div>

              {/* Alert Type */}
              <div>
                <label className="block text-[11px] text-gray-500 uppercase tracking-wider font-medium mb-2">Alert Type</label>
                <select
                  value={newType}
                  onChange={e => setNewType(e.target.value as AlertType)}
                  className="w-full px-4 py-3 rounded-xl bg-carbon-800/80 border border-white/[0.06] text-white text-sm focus:outline-none focus:border-cyan-glow/30 focus:ring-1 focus:ring-cyan-glow/20 transition-all appearance-none cursor-pointer"
                >
                  <option value="Price Above">Price Above</option>
                  <option value="Price Below">Price Below</option>
                  <option value="Volume Spike">Volume Spike</option>
                  <option value="Arbitrage Found">Arbitrage Found</option>
                </select>
              </div>

              {/* Threshold */}
              <div>
                <label className="block text-[11px] text-gray-500 uppercase tracking-wider font-medium mb-2">Threshold Value</label>
                <input
                  type="number"
                  value={newThreshold}
                  onChange={e => setNewThreshold(e.target.value)}
                  placeholder={newType.includes('Price') ? '0.00' : newType === 'Volume Spike' ? '100' : '0.00'}
                  className="w-full px-4 py-3 rounded-xl bg-carbon-800/80 border border-white/[0.06] text-white text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-cyan-glow/30 focus:ring-1 focus:ring-cyan-glow/20 transition-all"
                />
              </div>

              {/* Enable Toggle */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm text-white font-medium">Enable immediately</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Start monitoring as soon as created</p>
                </div>
                <button
                  type="button"
                  onClick={() => setNewEnabled(!newEnabled)}
                  className={`relative w-12 h-7 rounded-full transition-all duration-300 ${
                    newEnabled
                      ? 'bg-cyan-glow/30 border border-cyan-glow/40'
                      : 'bg-carbon-700 border border-white/[0.08]'
                  }`}
                >
                  <div className={`absolute top-0.5 w-6 h-6 rounded-full transition-all duration-300 shadow-md ${
                    newEnabled
                      ? 'left-[22px] bg-cyan-glow'
                      : 'left-0.5 bg-gray-500'
                  }`} />
                </button>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 px-4 rounded-xl font-medium text-sm border border-white/[0.08] text-gray-400 hover:bg-white/[0.04] hover:text-white transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  className="flex-1 py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-600 to-cyan-glow text-carbon-950 hover:shadow-glow-cyan transition-all duration-300"
                >
                  Create Alert
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Active Alerts Table ──────────────────────────────────────────────── */}
      <div className="glass-panel p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-glow/[0.06]">
              <Activity className="w-4 h-4 text-cyan-glow/70" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Active Alerts</h2>
              <p className="text-[11px] text-gray-500 font-mono">{activeAlerts.length} configured</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left text-[10px] text-gray-500 uppercase tracking-wider font-medium py-3 px-4">Skin</th>
                <th className="text-left text-[10px] text-gray-500 uppercase tracking-wider font-medium py-3 px-4">Type</th>
                <th className="text-left text-[10px] text-gray-500 uppercase tracking-wider font-medium py-3 px-4">Condition</th>
                <th className="text-left text-[10px] text-gray-500 uppercase tracking-wider font-medium py-3 px-4">Status</th>
                <th className="text-left text-[10px] text-gray-500 uppercase tracking-wider font-medium py-3 px-4">Created</th>
                <th className="text-right text-[10px] text-gray-500 uppercase tracking-wider font-medium py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeAlerts.map((alert) => (
                <tr key={alert.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="py-4 px-4">
                    <span className="text-sm text-white font-medium">{alert.skin}</span>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-md bg-cyan-glow/[0.06] text-cyan-glow/60">
                        {alertTypeIcon(alert.type)}
                      </div>
                      <span className="text-sm text-gray-400">{alert.type}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className="text-sm text-gray-300 font-mono">{conditionLabel(alert)}</span>
                  </td>
                  <td className="py-4 px-4">
                    {alert.status === 'Active' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-cyan-glow/[0.08] text-cyan-glow border border-cyan-glow/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-glow" style={{ boxShadow: '0 0 4px rgba(0,229,255,0.6)' }} />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-gray-500/[0.08] text-gray-400 border border-gray-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                        Paused
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-4">
                    <span className="text-sm text-gray-500 font-mono">{alert.createdAt}</span>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => toggleStatus(alert.id)}
                        title={alert.status === 'Active' ? 'Pause' : 'Resume'}
                        className="p-2 rounded-lg hover:bg-white/[0.06] text-gray-500 hover:text-white transition-colors"
                      >
                        {alert.status === 'Active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => deleteAlert(alert.id)}
                        title="Delete"
                        className="p-2 rounded-lg hover:bg-red-500/[0.1] text-gray-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        title="Test"
                        className="p-2 rounded-lg hover:bg-gold-400/[0.1] text-gray-500 hover:text-gold-400 transition-colors"
                      >
                        <FlaskConical className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Triggered Alerts History ─────────────────────────────────────────── */}
      <div className="glass-panel p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gold-400/[0.08]">
              <Zap className="w-4 h-4 text-gold-400/70" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Triggered History</h2>
              <p className="text-[11px] text-gray-500 font-mono">{triggeredAlerts.length} events</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left text-[10px] text-gray-500 uppercase tracking-wider font-medium py-3 px-4">Skin</th>
                <th className="text-left text-[10px] text-gray-500 uppercase tracking-wider font-medium py-3 px-4">Alert Type</th>
                <th className="text-left text-[10px] text-gray-500 uppercase tracking-wider font-medium py-3 px-4">Triggered At</th>
                <th className="text-left text-[10px] text-gray-500 uppercase tracking-wider font-medium py-3 px-4">Triggered Value</th>
                <th className="text-right text-[10px] text-gray-500 uppercase tracking-wider font-medium py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {triggeredAlerts.map((alert) => (
                <tr key={alert.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="py-4 px-4">
                    <span className="text-sm text-white font-medium">{alert.skin}</span>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-md bg-gold-400/[0.08] text-gold-400/60">
                        {alertTypeIcon(alert.type)}
                      </div>
                      <span className="text-sm text-gray-400">{alert.type}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className="text-sm text-gray-400 font-mono">{alert.triggeredAt}</span>
                  </td>
                  <td className="py-4 px-4">
                    <span className="text-sm text-gold-300 font-mono font-bold">{alert.triggeredValue}</span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    {alert.acknowledged ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/[0.08] text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" />
                        Acknowledged
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-gold-400/[0.08] text-gold-400 border border-gold-400/20" style={{ boxShadow: '0 0 8px rgba(245,158,11,0.15)' }}>
                        <BellRing className="w-3 h-3" />
                        Triggered
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Footer Note ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-2 py-2">
        <Shield className="w-3.5 h-3.5 text-gray-600" />
        <span className="text-[11px] text-gray-600 font-mono">Alerts are processed in real-time via WebSocket connection</span>
      </div>
    </div>
  );
};

export default Alerts;
