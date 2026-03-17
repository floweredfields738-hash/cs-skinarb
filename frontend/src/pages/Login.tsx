import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, TrendingUp, Zap, Brain, Mail } from 'lucide-react';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);

  const handleSteamLogin = () => {
    window.location.href = '/api/auth/steam';
  };

  const handleMagicLink = async () => {
    if (!email) return;
    setEmailLoading(true);
    try {
      const res = await fetch('/api/auth/email/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.success) setEmailSent(true);
    } catch { /* silent */ }
    finally { setEmailLoading(false); }
  };

  const features = [
    { icon: TrendingUp, text: 'Real-time market data across all platforms' },
    { icon: Brain, text: 'AI-powered opportunity scoring' },
    { icon: Zap, text: 'Automated arbitrage detection' },
    { icon: Shield, text: 'Price predictions with ML' },
  ];

  return (
    <div className="min-h-screen carbon-bg flex items-center justify-center relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-glow/[0.03] rounded-full blur-[120px]"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gold-400/[0.02] rounded-full blur-[120px]"></div>

      <div className="w-full max-w-md relative z-10 px-4">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-cyan-glow flex items-center justify-center mx-auto mb-5 shadow-glow-cyan">
            <span className="text-carbon-950 text-2xl font-extrabold tracking-tighter">CS</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">CSkinArb</h1>
          <p className="text-gray-500 text-sm">Professional Trading Platform</p>
        </div>

        {/* Login Card */}
        <div className="glass-panel p-8">
          <h2 className="text-xl font-bold text-white mb-6">Sign In</h2>

          {/* Features */}
          <div className="space-y-3 mb-8">
            {features.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <div key={idx} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-cyan-glow/[0.06] flex items-center justify-center flex-shrink-0">
                    <Icon className="w-3.5 h-3.5 text-cyan-glow/70" />
                  </div>
                  <p className="text-gray-400 text-sm">{feature.text}</p>
                </div>
              );
            })}
          </div>

          {/* Steam Login Button */}
          <button
            onClick={handleSteamLogin}
            className="w-full py-3.5 px-4 rounded-xl font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-600 to-cyan-glow text-carbon-950 hover:shadow-glow-cyan"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            Sign In with Steam
          </button>

          {/* Discord Login Button */}
          <a
            href="/api/auth/discord"
            className="w-full py-3.5 px-4 rounded-xl font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 mt-3"
            style={{ backgroundColor: '#5865F2', color: '#fff' }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            Sign In with Discord
          </a>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-white/[0.06]"></div>
            <span className="text-[10px] text-gray-600 uppercase tracking-widest font-mono">or sign in with email</span>
            <div className="flex-1 h-px bg-white/[0.06]"></div>
          </div>

          {/* Magic Link */}
          {emailSent ? (
            <div className="text-center py-3 px-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <Mail className="w-5 h-5 text-emerald-400 mx-auto mb-2" />
              <p className="text-emerald-400 text-sm font-medium">Check your inbox</p>
              <p className="text-gray-500 text-[11px] mt-1">We sent a login link to {email}</p>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="flex-1 px-4 py-3 rounded-xl bg-carbon-800/80 border border-white/[0.06] text-white text-sm focus:outline-none focus:border-cyan-glow/30 transition-all"
                onKeyDown={e => e.key === 'Enter' && handleMagicLink()}
              />
              <button
                onClick={handleMagicLink}
                disabled={!email || emailLoading}
                className="px-4 py-3 rounded-xl font-bold text-sm bg-white/[0.06] border border-white/[0.08] text-gray-300 hover:bg-white/[0.1] transition-all disabled:opacity-40"
              >
                {emailLoading ? '...' : 'Send'}
              </button>
            </div>
          )}

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-white/[0.06]"></div>
            <span className="text-[10px] text-gray-600 uppercase tracking-widest font-mono">or</span>
            <div className="flex-1 h-px bg-white/[0.06]"></div>
          </div>

          {/* Guest button */}
          <button
            onClick={() => navigate('/')}
            className="w-full py-3 px-4 rounded-xl font-medium text-sm transition-all duration-200 border border-white/[0.08] text-gray-400 hover:bg-white/[0.04] hover:text-white hover:border-white/[0.12]"
          >
            Continue as Guest
          </button>

          <p className="text-gray-600 text-[10px] text-center mt-6 font-mono">
            By signing in, you agree to our Terms of Service
          </p>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-gray-600 text-[11px] font-mono">
          <p>Secure authentication via Steam</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
