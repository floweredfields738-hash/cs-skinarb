import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import {
  User,
  Globe,
  Bell,
  Database,
  AlertTriangle,
  Trash2,
  Save,
  Shield,
  ShieldCheck,
  ShieldOff,
  Monitor,
  Mail,
  Smartphone,
  TrendingUp,
  ArrowRightLeft,
  FileText,
  RefreshCw,
  Key,
  Clock,
  Copy,
  Check,
} from 'lucide-react';

// ── Profile Section (real user data) ──────────────────────────────────────────
const ProfileSection: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  return (
    <div className="flex items-center gap-6">
      {user?.avatar_url ? (
        <img src={user.avatar_url} alt="" className="w-20 h-20 rounded-2xl border border-cyan-glow/20 flex-shrink-0" />
      ) : (
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-600/20 to-cyan-glow/10 border border-cyan-glow/20 flex items-center justify-center flex-shrink-0">
          <User className="w-8 h-8 text-cyan-glow/50" />
        </div>
      )}
      <div className="flex-1 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-1">Username</p>
            <p className="text-sm text-white font-medium font-mono">{user?.username || 'Guest'}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-1">Steam ID</p>
            <p className="text-sm text-gray-300 font-mono">{user?.steam_id || '—'}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-1">Member Since</p>
            <p className="text-sm text-gray-300 font-mono">{user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Premium Section ──────────────────────────────────────────────────────────
const PremiumSection: React.FC = () => {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) return;
    fetch('/api/billing/status', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.success) setStatus(d); })
      .catch(() => {});
  }, []);

  const checkout = async (plan: string) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else alert(data.error || 'Failed to start checkout');
    } catch {} finally { setLoading(false); }
  };

  const cancel = async () => {
    if (!confirm('Cancel your premium subscription?')) return;
    const token = localStorage.getItem('authToken');
    const res = await fetch('/api/billing/cancel', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    if (data.success) { alert('Subscription will end at current billing period'); window.location.reload(); }
  };

  const isPremium = status?.tier === 'premium';

  return (
    <div className="glass-panel p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-gold-500/[0.08]">
          <Shield className="w-4 h-4 text-gold-400/70" />
        </div>
        <h2 className="text-lg font-bold text-white">CSkinArb Premium</h2>
        {isPremium && (
          <span className="ml-auto px-3 py-1 rounded-lg text-[10px] font-bold uppercase bg-gold-500/10 text-gold-400 border border-gold-500/20">
            Active
          </span>
        )}
      </div>

      {isPremium ? (
        <div>
          <p className="text-sm text-gray-400 mb-2">
            Your premium subscription is active{status?.expires ? ` until ${new Date(status.expires).toLocaleDateString()}` : ''}.
          </p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-carbon-800/50 rounded-xl p-3">
              <p className="text-[9px] text-gray-500 uppercase font-mono mb-1">Arbitrage</p>
              <p className="text-sm text-emerald-400 font-bold">Unlimited</p>
            </div>
            <div className="bg-carbon-800/50 rounded-xl p-3">
              <p className="text-[9px] text-gray-500 uppercase font-mono mb-1">Alerts</p>
              <p className="text-sm text-emerald-400 font-bold">50 max</p>
            </div>
            <div className="bg-carbon-800/50 rounded-xl p-3">
              <p className="text-[9px] text-gray-500 uppercase font-mono mb-1">Instant Alerts</p>
              <p className="text-sm text-emerald-400 font-bold">Enabled</p>
            </div>
            <div className="bg-carbon-800/50 rounded-xl p-3">
              <p className="text-[9px] text-gray-500 uppercase font-mono mb-1">API Requests</p>
              <p className="text-sm text-emerald-400 font-bold">5,000/day</p>
            </div>
          </div>
          <button onClick={cancel} className="text-[11px] text-gray-600 hover:text-red-400 transition-colors">
            Cancel subscription
          </button>
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Free */}
            <div className="bg-carbon-800/50 rounded-xl p-5 border border-white/[0.04]">
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Free</p>
              <p className="text-2xl font-bold text-white mb-3">$0</p>
              <ul className="space-y-1.5 text-[11px] text-gray-500">
                <li>5 arbitrage opportunities</li>
                <li>3 price alerts</li>
                <li>7 days history</li>
                <li>100 API requests/day</li>
              </ul>
            </div>
            {/* Premium */}
            <div className="bg-gradient-to-br from-gold-500/5 to-cyan-glow/5 rounded-xl p-5 border border-gold-500/20">
              <p className="text-xs text-gold-400 uppercase font-bold tracking-wider mb-1">Premium</p>
              <p className="text-2xl font-bold text-white mb-0.5">$9.99<span className="text-sm text-gray-500 font-normal">/mo</span></p>
              <p className="text-[10px] text-gray-500 mb-3">or $79.99/yr (save 33%)</p>
              <ul className="space-y-1.5 text-[11px] text-cyan-glow/80">
                <li>Unlimited arbitrage</li>
                <li>50 price alerts</li>
                <li>Instant notifications</li>
                <li>Auto-sniper watchlist</li>
                <li>Profit backtester</li>
                <li>90 days history</li>
                <li>5,000 API requests/day</li>
              </ul>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => checkout('monthly')}
              disabled={loading}
              className="flex-1 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-gold-500/20 to-cyan-glow/10 text-white border border-gold-500/20 hover:border-gold-500/40 transition-all disabled:opacity-40"
            >
              {loading ? 'Loading...' : 'Go Premium — $9.99/mo'}
            </button>
            <button
              onClick={() => checkout('yearly')}
              disabled={loading}
              className="flex-1 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-600 to-cyan-glow text-carbon-950 hover:shadow-glow-cyan transition-all disabled:opacity-40"
            >
              {loading ? 'Loading...' : 'Yearly — $79.99/yr'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Telegram Linker ──────────────────────────────────────────────────────────
const TelegramLinker: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const botName = 'CSkinArbBot'; // User will need to create this via @BotFather

  if (!user) return null;

  const linkUrl = `https://t.me/${botName}?start=${user.id}`;

  return (
    <div>
      <p className="text-xs text-gray-500 mb-3">
        Click the button below to open Telegram and link your account. You'll start receiving alerts immediately.
      </p>
      <a
        href={linkUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90"
        style={{ backgroundColor: '#0088cc' }}
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
        </svg>
        Link Telegram
      </a>
      <p className="text-[10px] text-gray-600 font-mono mt-3">
        Bot commands: /arb · /alerts · /mute · /unmute
      </p>
    </div>
  );
};

// ── Hardware Key Manager ───────────────────────────────────────────────────────
const HardwareKeyManager: React.FC = () => {
  const [keys, setKeys] = useState<{ id: number; device_name: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [deviceName, setDeviceName] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) return;
    fetch('/api/auth/webauthn/keys', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.success) setKeys(d.keys || []); })
      .catch(() => {});
  }, []);

  const registerKey = async () => {
    setLoading(true);
    setMessage('');
    try {
      const token = localStorage.getItem('authToken');
      // 1. Get registration options
      const startRes = await fetch('/api/auth/webauthn/register/start', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const { options } = await startRes.json();

      // 2. Create credential with browser WebAuthn API
      const { startRegistration } = await import('@simplewebauthn/browser');
      const credential = await startRegistration({ optionsJSON: options });

      // 3. Send to server to verify
      const finishRes = await fetch('/api/auth/webauthn/register/finish', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential, deviceName: deviceName || 'Security Key' }),
      });
      const result = await finishRes.json();

      if (result.success) {
        setMessage('Security key registered!');
        setDeviceName('');
        // Refresh keys list
        const keysRes = await fetch('/api/auth/webauthn/keys', { headers: { Authorization: `Bearer ${token}` } });
        const keysData = await keysRes.json();
        if (keysData.success) setKeys(keysData.keys || []);
      } else {
        setMessage(result.error || 'Registration failed');
      }
    } catch (err: any) {
      setMessage(err.name === 'NotAllowedError' ? 'Cancelled by user' : `Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const removeKey = async (keyId: number) => {
    const token = localStorage.getItem('authToken');
    await fetch(`/api/auth/webauthn/keys/${keyId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    setKeys(keys.filter(k => k.id !== keyId));
  };

  return (
    <div>
      {message && (
        <div className={`mb-4 px-4 py-2.5 rounded-xl text-sm ${
          message.includes('registered') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            : 'bg-red-500/10 text-red-400 border border-red-500/20'
        }`}>
          {message}
        </div>
      )}

      {/* Registered keys */}
      {keys.length > 0 && (
        <div className="mb-4 space-y-2">
          {keys.map(k => (
            <div key={k.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-carbon-800/50 border border-white/[0.04]">
              <div className="flex items-center gap-3">
                <Key className="w-4 h-4 text-cyan-glow/50" />
                <div>
                  <p className="text-sm text-white font-medium">{k.device_name}</p>
                  <p className="text-[10px] text-gray-600 font-mono">Added {new Date(k.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              <button
                onClick={() => removeKey(k.id)}
                className="text-red-400/50 hover:text-red-400 text-xs transition-colors"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new key */}
      <div className="flex gap-3">
        <input
          type="text"
          value={deviceName}
          onChange={e => setDeviceName(e.target.value)}
          placeholder="Key name (e.g. YubiKey 5)"
          className="flex-1 px-4 py-3 rounded-xl bg-carbon-800/80 border border-white/[0.06] text-white text-sm focus:outline-none focus:border-cyan-glow/30 transition-all"
        />
        <button
          onClick={registerKey}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-600 to-cyan-glow text-carbon-950 hover:shadow-glow-cyan transition-all disabled:opacity-40"
        >
          <Key className="w-4 h-4" />
          {loading ? 'Waiting...' : 'Add Key'}
        </button>
      </div>
    </div>
  );
};

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

  // 2FA
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [twoFASetup, setTwoFASetup] = useState<{ qrCode: string; secret: string; backupCodes: string[] } | null>(null);
  const [twoFACode, setTwoFACode] = useState('');
  const [twoFALoading, setTwoFALoading] = useState(false);
  const [twoFAMessage, setTwoFAMessage] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [copiedBackup, setCopiedBackup] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    const token = localStorage.getItem('authToken');
    fetch('/api/auth/2fa/status', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.success) setTwoFAEnabled(d.enabled); })
      .catch(() => {});
  }, [isAuthenticated]);

  const setup2FA = async () => {
    setTwoFALoading(true);
    setTwoFAMessage('');
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch('/api/auth/2fa/setup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        setTwoFASetup({ qrCode: data.qrCode, secret: data.secret, backupCodes: data.backupCodes });
      } else {
        setTwoFAMessage(data.error || 'Failed to setup 2FA');
      }
    } catch { setTwoFAMessage('Failed to connect'); }
    finally { setTwoFALoading(false); }
  };

  const verify2FA = async () => {
    setTwoFALoading(true);
    setTwoFAMessage('');
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: twoFACode }),
      });
      const data = await res.json();
      if (data.success) {
        setTwoFAEnabled(true);
        setTwoFASetup(null);
        setTwoFACode('');
        setTwoFAMessage('2FA enabled successfully!');
      } else {
        setTwoFAMessage(data.error || 'Invalid code');
      }
    } catch { setTwoFAMessage('Failed to verify'); }
    finally { setTwoFALoading(false); }
  };

  const disable2FA = async () => {
    setTwoFALoading(true);
    setTwoFAMessage('');
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: disableCode }),
      });
      const data = await res.json();
      if (data.success) {
        setTwoFAEnabled(false);
        setDisableCode('');
        setTwoFAMessage('2FA disabled');
      } else {
        setTwoFAMessage(data.error || 'Invalid code');
      }
    } catch { setTwoFAMessage('Failed to disable'); }
    finally { setTwoFALoading(false); }
  };

  // API
  const [refreshInterval, setRefreshInterval] = useState('5min');

  // Shared input class
  const selectClass =
    'w-full px-4 py-3 rounded-xl bg-carbon-800/80 border border-white/[0.06] text-white text-sm focus:outline-none focus:border-cyan-glow/30 focus:ring-1 focus:ring-cyan-glow/20 transition-all appearance-none cursor-pointer';

  const themes = ['Dark', 'Midnight', 'OLED'] as const;

  return (
    <div className="space-y-6 max-w-[900px] mx-auto fade-in">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">Settings</h1>
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

        <ProfileSection />
      </div>

      {/* ── Premium Subscription ──────────────────────────────────────────── */}
      {isAuthenticated && <PremiumSection />}

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

      {/* ── Two-Factor Authentication ─────────────────────────────────────── */}
      {isAuthenticated && (
        <div className="glass-panel p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-cyan-glow/[0.06]">
              <Shield className="w-4 h-4 text-cyan-glow/70" />
            </div>
            <h2 className="text-lg font-bold text-white">Two-Factor Authentication</h2>
            {twoFAEnabled && (
              <span className="ml-auto px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Enabled
              </span>
            )}
          </div>

          {twoFAMessage && (
            <div className={`mb-4 px-4 py-2.5 rounded-xl text-sm ${
              twoFAMessage.includes('success') || twoFAMessage.includes('enabled')
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
              {twoFAMessage}
            </div>
          )}

          {!twoFAEnabled && !twoFASetup && (
            <div>
              <p className="text-sm text-gray-400 mb-4">
                Add an extra layer of security to your account. You'll need an authenticator app like Google Authenticator, Authy, or 1Password.
              </p>
              <button
                onClick={setup2FA}
                disabled={twoFALoading}
                className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-600 to-cyan-glow text-carbon-950 hover:shadow-glow-cyan transition-all"
              >
                <ShieldCheck className="w-4 h-4" />
                {twoFALoading ? 'Setting up...' : 'Enable 2FA'}
              </button>
            </div>
          )}

          {twoFASetup && !twoFAEnabled && (
            <div className="space-y-5">
              {/* QR Code */}
              <div className="flex flex-col items-center">
                <p className="text-sm text-gray-400 mb-3">Scan this QR code with your authenticator app:</p>
                <div className="bg-white p-4 rounded-2xl">
                  <img src={twoFASetup.qrCode} alt="2FA QR Code" className="w-48 h-48" />
                </div>
                <p className="text-[10px] text-gray-600 font-mono mt-2">
                  Manual key: <span className="text-cyan-glow select-all">{twoFASetup.secret}</span>
                </p>
              </div>

              {/* Backup Codes */}
              <div>
                <p className="text-sm text-gray-400 mb-2">Save these backup codes somewhere safe:</p>
                <div className="bg-carbon-800/80 rounded-xl p-4 border border-white/[0.06]">
                  <div className="grid grid-cols-4 gap-2">
                    {twoFASetup.backupCodes.map((code, i) => (
                      <span key={i} className="text-xs font-mono text-cyan-glow/80 bg-carbon-900/50 px-2 py-1.5 rounded text-center">
                        {code}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(twoFASetup.backupCodes.join('\n'));
                      setCopiedBackup(true);
                      setTimeout(() => setCopiedBackup(false), 2000);
                    }}
                    className="flex items-center gap-1.5 mt-3 text-[11px] text-gray-500 hover:text-cyan-glow transition-colors"
                  >
                    {copiedBackup ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedBackup ? 'Copied!' : 'Copy all codes'}
                  </button>
                </div>
              </div>

              {/* Verify */}
              <div>
                <p className="text-sm text-gray-400 mb-2">Enter the 6-digit code from your authenticator app:</p>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={twoFACode}
                    onChange={e => setTwoFACode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    className="w-40 px-4 py-3 rounded-xl bg-carbon-800/80 border border-white/[0.06] text-white text-lg font-mono tracking-[0.5em] text-center focus:outline-none focus:border-cyan-glow/30 transition-all"
                  />
                  <button
                    onClick={verify2FA}
                    disabled={twoFACode.length !== 6 || twoFALoading}
                    className="px-5 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-600 to-cyan-glow text-carbon-950 hover:shadow-glow-cyan transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {twoFALoading ? 'Verifying...' : 'Verify & Enable'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {twoFAEnabled && (
            <div>
              <p className="text-sm text-gray-400 mb-4">
                Your account is protected with two-factor authentication. Enter your current code to disable it.
              </p>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={disableCode}
                  onChange={e => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter code"
                  maxLength={6}
                  className="w-40 px-4 py-3 rounded-xl bg-carbon-800/80 border border-white/[0.06] text-white text-lg font-mono tracking-[0.5em] text-center focus:outline-none focus:border-cyan-glow/30 transition-all"
                />
                <button
                  onClick={disable2FA}
                  disabled={disableCode.length < 6 || twoFALoading}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm border border-red-500/20 text-red-400 bg-red-500/[0.06] hover:bg-red-500/[0.12] transition-all disabled:opacity-40"
                >
                  <ShieldOff className="w-4 h-4" />
                  {twoFALoading ? 'Disabling...' : 'Disable 2FA'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Telegram ─────────────────────────────────────────────────────── */}
      {isAuthenticated && (
        <div className="glass-panel p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-cyan-glow/[0.06]">
              <Bell className="w-4 h-4 text-cyan-glow/70" />
            </div>
            <h2 className="text-lg font-bold text-white">Telegram Alerts</h2>
          </div>
          <p className="text-sm text-gray-400 mb-4">
            Get price alerts and arbitrage opportunities sent directly to your Telegram.
          </p>
          <TelegramLinker />
        </div>
      )}

      {/* ── Hardware Keys (WebAuthn) ─────────────────────────────────────── */}
      {isAuthenticated && (
        <div className="glass-panel p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-cyan-glow/[0.06]">
              <Key className="w-4 h-4 text-cyan-glow/70" />
            </div>
            <h2 className="text-lg font-bold text-white">Hardware Security Keys</h2>
          </div>

          <p className="text-sm text-gray-400 mb-4">
            Use a physical security key (YubiKey, Titan, etc.) or your device's biometric sensor for passwordless login.
          </p>

          <HardwareKeyManager />
        </div>
      )}

      {/* ── API & Data Section ──────────────────────────────────────────────── */}
      <div className="glass-panel p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-cyan-glow/[0.06]">
            <Database className="w-4 h-4 text-cyan-glow/70" />
          </div>
          <h2 className="text-lg font-bold text-white">API & Data</h2>
        </div>

        <div className="space-y-6">
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
            <button onClick={() => { localStorage.clear(); alert('Cache cleared. Page will reload.'); window.location.reload(); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-white/[0.08] text-gray-400 hover:bg-white/[0.04] hover:text-white transition-all">
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
          <button onClick={async () => {
            if (!confirm('Are you sure? This permanently deletes your account and all data.')) return;
            if (!confirm('This CANNOT be undone. Type YES to confirm.')) return;
            const token = localStorage.getItem('authToken');
            await fetch('/api/auth/account', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
            localStorage.clear();
            window.location.href = '/login';
          }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border border-red-500/20 text-red-400 bg-red-500/[0.06] hover:bg-red-500/[0.12] hover:border-red-500/30 transition-all">
            <Trash2 className="w-3.5 h-3.5" />
            Delete Account
          </button>
        </div>
      </div>

      {/* ── Save Button ─────────────────────────────────────────────────────── */}
      <div className="flex justify-end pb-4">
        <button onClick={async () => {
          const token = localStorage.getItem('authToken');
          if (!token) { alert('Sign in to save settings'); return; }
          await fetch('/api/auth/preferences', {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ preferences: { currency, theme, defaultMarket, emailNotif, pushNotif, priceAlerts, arbAlerts: arbAlerts, weeklyDigest } }),
          });
          alert('Settings saved!');
        }} className="flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-sm transition-all duration-300 bg-gradient-to-r from-cyan-600 to-cyan-glow text-carbon-950 hover:shadow-glow-cyan">
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
