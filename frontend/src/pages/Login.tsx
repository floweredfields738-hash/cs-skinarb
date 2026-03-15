import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, TrendingUp, Zap, Brain } from 'lucide-react';

const Login: React.FC = () => {
  const navigate = useNavigate();

  const handleSteamLogin = () => {
    window.location.href = '/api/auth/steam';
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
          <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Skin Intelligence</h1>
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

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-white/[0.06]"></div>
            <span className="text-[10px] text-gray-600 uppercase tracking-widest font-mono">or continue as</span>
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
