import React, { useState } from 'react';
import {
  User,
  Globe,
  Bell,
  Database,
  AlertTriangle,
  Eye,
  EyeOff,
  Trash2,
  Save,
  Shield,
  Monitor,
  Mail,
  Smartphone,
  TrendingUp,
  ArrowRightLeft,
  FileText,
  RefreshCw,
  Key,
  Clock,
} from 'lucide-react';

// ── Toggle Switch ──────────────────────────────────────────────────────────────
const ToggleSwitch: React.FC<{ enabled: boolean; onChange: () => void }> = ({ enabled, onChange }) => (
  <button
    type="button"
    onClick={onChange}
    className={`relative w-12 h-7 rounded-full transition-all duration-300 flex-shrink-0 ${
      enabled
        ? 'bg-cyan-glow/30 border border-cyan-glow/40'
        : 'bg-carbon-700 border border-white/[0.08]'
    }`}
  >
    <div
      className={`absolute top-0.5 w-6 h-6 rounded-full transition-all duration-300 shadow-md ${
        enabled ? 'left-[22px] bg-cyan-glow' : 'left-0.5 bg-gray-500'
      }`}
    />
  </button>
);

// ── Notification Row ───────────────────────────────────────────────────────────
const NotifRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  description: string;
  enabled: boolean;
  onChange: () => void;
}> = ({ icon, label, description, enabled, onChange }) => (
  <div className="flex items-center justify-between py-4 border-b border-white/[0.04] last:border-b-0">
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-lg bg-cyan-glow/[0.06] text-cyan-glow/60">
        {icon}
      </div>
      <div>
        <p className="text-sm text-white font-medium">{label}</p>
        <p className="text-[11px] text-gray-500 mt-0.5">{description}</p>
      </div>
    </div>
    <ToggleSwitch enabled={enabled} onChange={onChange} />
  </div>
);

// ── Component ──────────────────────────────────────────────────────────────────
const Settings: React.FC = () => {
  // Preferences
  const [currency, setCurrency] = useState('USD');
  const [theme, setTheme] = useState('Dark');
  const [defaultMarket, setDefaultMarket] = useState('Steam');

  // Notifications
  const [emailNotif, setEmailNotif] = useState(true);
  const [pushNotif, setPushNotif] = useState(true);
  const [priceAlerts, setPriceAlerts] = useState(true);
  const [arbAlerts, setArbAlerts] = useState(false);
  const [weeklyDigest, setWeeklyDigest] = useState(true);

  // API
  const [showApiKey, setShowApiKey] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState('5min');
  const apiKey = 'sk-steam-7f3a9c2d8e1b4f6a0d5c3e9b7a2f8d1e';

  // Shared input class
  const selectClass =
    'w-full px-4 py-3 rounded-xl bg-carbon-800/80 border border-white/[0.06] text-white text-sm focus:outline-none focus:border-cyan-glow/30 focus:ring-1 focus:ring-cyan-glow/20 transition-all appearance-none cursor-pointer';

  const themes = ['Dark', 'Midnight', 'OLED'] as const;

  return (
    <div className="space-y-6 max-w-[900px] mx-auto fade-in">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your account preferences and platform configuration</p>
      </div>

      {/* ── Profile Section ─────────────────────────────────────────────────── */}
      <div className="glass-panel p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-cyan-glow/[0.06]">
            <User className="w-4 h-4 text-cyan-glow/70" />
          </div>
          <h2 className="text-lg font-bold text-white">Profile</h2>
        </div>

        <div className="flex items-center gap-6">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-600/20 to-cyan-glow/10 border border-cyan-glow/20 flex items-center justify-center flex-shrink-0">
            <User className="w-8 h-8 text-cyan-glow/50" />
          </div>

          {/* Info */}
          <div className="flex-1 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-1">Username</p>
                <p className="text-sm text-white font-medium font-mono">SkinTrader_Pro</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-1">Steam ID</p>
                <p className="text-sm text-gray-300 font-mono">76561198042583142</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-1">Member Since</p>
                <p className="text-sm text-gray-300 font-mono">Jan 2025</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Preferences Section ─────────────────────────────────────────────── */}
      <div className="glass-panel p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-cyan-glow/[0.06]">
            <Globe className="w-4 h-4 text-cyan-glow/70" />
          </div>
          <h2 className="text-lg font-bold text-white">Preferences</h2>
        </div>

        <div className="space-y-6">
          {/* Currency */}
          <div>
            <label className="block text-[11px] text-gray-500 uppercase tracking-wider font-medium mb-2">Currency</label>
            <select value={currency} onChange={e => setCurrency(e.target.value)} className={selectClass}>
              <option value="USD">USD — US Dollar</option>
              <option value="EUR">EUR — Euro</option>
              <option value="GBP">GBP — British Pound</option>
              <option value="CNY">CNY — Chinese Yuan</option>
            </select>
          </div>

          {/* Theme */}
          <div>
            <label className="block text-[11px] text-gray-500 uppercase tracking-wider font-medium mb-3">Theme</label>
            <div className="flex gap-3">
              {themes.map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-medium transition-all duration-300 border ${
                    theme === t
                      ? 'bg-cyan-glow/[0.08] border-cyan-glow/30 text-cyan-glow'
                      : 'bg-carbon-800/60 border-white/[0.06] text-gray-400 hover:bg-white/[0.04] hover:text-white'
                  }`}
                >
                  <Monitor className="w-4 h-4" />
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Default Market */}
          <div>
            <label className="block text-[11px] text-gray-500 uppercase tracking-wider font-medium mb-2">Default Market</label>
            <select value={defaultMarket} onChange={e => setDefaultMarket(e.target.value)} className={selectClass}>
              <option value="Steam">Steam Community Market</option>
              <option value="Buff163">Buff163</option>
              <option value="Skinport">Skinport</option>
              <option value="CSFloat">CSFloat</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Notifications Section ───────────────────────────────────────────── */}
      <div className="glass-panel p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-cyan-glow/[0.06]">
            <Bell className="w-4 h-4 text-cyan-glow/70" />
          </div>
          <h2 className="text-lg font-bold text-white">Notifications</h2>
        </div>

        <div>
          <NotifRow
            icon={<Mail className="w-4 h-4" />}
            label="Email Notifications"
            description="Receive alerts and reports via email"
            enabled={emailNotif}
            onChange={() => setEmailNotif(!emailNotif)}
          />
          <NotifRow
            icon={<Smartphone className="w-4 h-4" />}
            label="Push Notifications"
            description="Browser and mobile push alerts"
            enabled={pushNotif}
            onChange={() => setPushNotif(!pushNotif)}
          />
          <NotifRow
            icon={<TrendingUp className="w-4 h-4" />}
            label="Price Alerts"
            description="Notify when price thresholds are hit"
            enabled={priceAlerts}
            onChange={() => setPriceAlerts(!priceAlerts)}
          />
          <NotifRow
            icon={<ArrowRightLeft className="w-4 h-4" />}
            label="Arbitrage Alerts"
            description="Notify on new arbitrage opportunities"
            enabled={arbAlerts}
            onChange={() => setArbAlerts(!arbAlerts)}
          />
          <NotifRow
            icon={<FileText className="w-4 h-4" />}
            label="Weekly Digest"
            description="Summary of market trends every Monday"
            enabled={weeklyDigest}
            onChange={() => setWeeklyDigest(!weeklyDigest)}
          />
        </div>
      </div>

      {/* ── API & Data Section ──────────────────────────────────────────────── */}
      <div className="glass-panel p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-cyan-glow/[0.06]">
            <Database className="w-4 h-4 text-cyan-glow/70" />
          </div>
          <h2 className="text-lg font-bold text-white">API & Data</h2>
        </div>

        <div className="space-y-6">
          {/* Steam API Key */}
          <div>
            <label className="block text-[11px] text-gray-500 uppercase tracking-wider font-medium mb-2">Steam API Key</label>
            <div className="relative">
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    readOnly
                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-carbon-800/80 border border-white/[0.06] text-white text-sm font-mono focus:outline-none focus:border-cyan-glow/30 transition-all"
                  />
                </div>
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="p-3 rounded-xl bg-carbon-800/80 border border-white/[0.06] text-gray-400 hover:text-white hover:border-white/[0.12] transition-all"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Refresh Interval */}
          <div>
            <label className="block text-[11px] text-gray-500 uppercase tracking-wider font-medium mb-2">Data Refresh Interval</label>
            <div className="relative">
              <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 z-10 pointer-events-none" />
              <select
                value={refreshInterval}
                onChange={e => setRefreshInterval(e.target.value)}
                className={`${selectClass} pl-11`}
              >
                <option value="1min">Every 1 minute</option>
                <option value="5min">Every 5 minutes</option>
                <option value="15min">Every 15 minutes</option>
                <option value="30min">Every 30 minutes</option>
              </select>
            </div>
          </div>

          {/* Clear Cache */}
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm text-white font-medium">Cache Storage</p>
              <p className="text-[11px] text-gray-500 mt-0.5">Clear locally cached market data and preferences</p>
            </div>
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-white/[0.08] text-gray-400 hover:bg-white/[0.04] hover:text-white transition-all">
              <RefreshCw className="w-3.5 h-3.5" />
              Clear Cache
            </button>
          </div>
        </div>
      </div>

      {/* ── Danger Zone ─────────────────────────────────────────────────────── */}
      <div className="glass-panel p-6 border-red-500/10">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-red-500/[0.08]">
            <AlertTriangle className="w-4 h-4 text-red-400/70" />
          </div>
          <h2 className="text-lg font-bold text-white">Danger Zone</h2>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white font-medium">Delete Account</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Permanently remove your account and all associated data. This cannot be undone.</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border border-red-500/20 text-red-400 bg-red-500/[0.06] hover:bg-red-500/[0.12] hover:border-red-500/30 transition-all">
            <Trash2 className="w-3.5 h-3.5" />
            Delete Account
          </button>
        </div>
      </div>

      {/* ── Save Button ─────────────────────────────────────────────────────── */}
      <div className="flex justify-end pb-4">
        <button className="flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-sm transition-all duration-300 bg-gradient-to-r from-cyan-600 to-cyan-glow text-carbon-950 hover:shadow-glow-cyan">
          <Save className="w-4 h-4" />
          Save Changes
        </button>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-2 pb-2">
        <Shield className="w-3.5 h-3.5 text-gray-600" />
        <span className="text-[11px] text-gray-600 font-mono">Your data is encrypted and securely stored</span>
      </div>
    </div>
  );
};

export default Settings;
