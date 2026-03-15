import React from 'react';
import { Link } from 'react-router-dom';
import { Bell, User, LogOut, Menu } from 'lucide-react';
import { useConnectionStatus } from '../../hooks/useRealTimeData';
import LiveTicker from './LiveTicker';

interface HeaderProps {
  onMenuClick: () => void;
  userName?: string;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick, userName, onLogout }) => {
  const [showDropdown, setShowDropdown] = React.useState(false);
  const connected = useConnectionStatus();

  return (
    <header className="bg-carbon-800/80 backdrop-blur-xl border-b border-white/[0.06] px-6 py-3 flex items-center justify-between">
      {/* Left Section */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="p-2 hover:bg-white/[0.06] rounded-lg transition-all duration-200"
        >
          <Menu className="w-5 h-5 text-gray-400" />
        </button>

        <Link to="/" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-glow flex items-center justify-center shadow-glow-cyan">
            <span className="text-carbon-950 font-extrabold text-sm tracking-tight">CS</span>
          </div>
          <div className="hidden sm:block">
            <span className="font-bold text-white text-sm tracking-wide">SKIN INTELLIGENCE</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div
                className={connected ? 'neon-dot' : ''}
                style={{
                  width: '4px',
                  height: '4px',
                  borderRadius: '50%',
                  backgroundColor: connected ? undefined : '#6b7280',
                }}
              ></div>
              <span className="text-[10px] text-cyan-glow/70 font-mono uppercase tracking-widest">
                {connected ? 'Live' : 'Offline'}
              </span>
            </div>
          </div>
        </Link>
      </div>

      {/* Center - Live Market Ticker (infinite sliding carousel) */}
      <div className="hidden md:block flex-1 mx-6 max-w-2xl">
        <LiveTicker />
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <Link
          to="/alerts"
          className="relative p-2.5 hover:bg-white/[0.06] rounded-lg transition-all duration-200"
        >
          <Bell className="w-4.5 h-4.5 text-gray-400" />
          <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-cyan-glow rounded-full" style={{ boxShadow: '0 0 6px rgba(0,229,255,0.6)' }}></span>
        </Link>

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2.5 p-2 hover:bg-white/[0.06] rounded-lg transition-all duration-200"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-gold-500/20 to-gold-400/10 border border-gold-500/20 flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-gold-400" />
            </div>
            <span className="text-sm text-gray-300 hidden sm:inline font-medium">{userName || 'Guest'}</span>
          </button>

          {showDropdown && (
            <div className="absolute right-0 mt-2 w-52 glass-panel p-1 z-50">
              <Link
                to="/settings"
                onClick={() => setShowDropdown(false)}
                className="block px-4 py-2.5 text-sm text-gray-300 hover:bg-white/[0.06] rounded-xl transition-all duration-200"
              >
                Settings
              </Link>
              <button
                onClick={() => { onLogout(); setShowDropdown(false); }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-white/[0.06] rounded-xl transition-all duration-200 flex items-center gap-2"
              >
                <LogOut className="w-3.5 h-3.5" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

    </header>
  );
};

export default Header;
