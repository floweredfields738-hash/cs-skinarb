import React, { useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Link } from 'react-router-dom';
import { Bell, User, LogOut, Menu, LogIn } from 'lucide-react';
import { useConnectionStatus } from '../../hooks/useRealTimeData';
import LiveTicker from './LiveTicker';

interface HeaderProps {
  onMenuClick: () => void;
  userName?: string;
  avatarUrl?: string;
  isAuthenticated?: boolean;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick, userName, avatarUrl, isAuthenticated, onLogout }) => {
  const [showDropdown, setShowDropdown] = React.useState(false);
  const [dropdownPos, setDropdownPos] = React.useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  useConnectionStatus(); // keep WS alive

  const toggleDropdown = useCallback(() => {
    if (!showDropdown && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 8, left: rect.right - 208 }); // 208 = w-52
    }
    setShowDropdown(!showDropdown);
  }, [showDropdown]);

  return (
    <header className="bg-carbon-800/80 backdrop-blur-xl border-b border-white/[0.06] px-6 py-3 flex items-center justify-between">
      {/* Left - Menu toggle */}
      <button
        onClick={onMenuClick}
        className="p-2 hover:bg-white/[0.06] rounded-lg transition-all duration-200"
      >
        <Menu className="w-5 h-5 text-gray-400" />
      </button>

      {/* Center - Live Market Ticker (expanded to fill header) */}
      <div className="hidden md:flex flex-1 mx-4 overflow-hidden">
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

        {/* User Menu / Login */}
        {isAuthenticated ? (
          <div className="relative">
            <button
              ref={btnRef}
              onClick={toggleDropdown}
              className="flex items-center gap-2.5 p-2 hover:bg-white/[0.06] rounded-lg transition-all duration-200"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-7 h-7 rounded-lg border border-cyan-glow/20" />
              ) : (
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/20 to-cyan-glow/10 border border-cyan-glow/20 flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-cyan-glow" />
                </div>
              )}
              <span className="text-sm text-gray-300 hidden sm:inline font-medium">{userName}</span>
            </button>

            {showDropdown && ReactDOM.createPortal(
              <>
                {/* Invisible backdrop to close dropdown when clicking outside */}
                <div
                  className="fixed inset-0"
                  style={{ zIndex: 99998 }}
                  onClick={() => setShowDropdown(false)}
                />
                {/* Dropdown menu rendered at document root so nothing can be above it */}
                <div
                  className="fixed w-52 glass-panel p-1 border border-white/[0.08] shadow-2xl"
                  style={{
                    zIndex: 99999,
                    top: dropdownPos.top,
                    left: dropdownPos.left,
                  }}
                >
                  <Link
                    to="/portfolio"
                    onClick={() => setShowDropdown(false)}
                    className="block px-4 py-2.5 text-sm text-gray-300 hover:bg-white/[0.06] rounded-xl transition-all duration-200"
                  >
                    Portfolio
                  </Link>
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
              </>,
              document.body
            )}
          </div>
        ) : (
          <a
            href="/login"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-glow/10 to-cyan-500/5 border border-cyan-glow/20 hover:border-cyan-glow/40 hover:bg-cyan-glow/15 transition-all duration-200"
          >
            <LogIn className="w-4 h-4 text-cyan-glow" />
            <span className="text-sm text-cyan-glow font-medium hidden sm:inline">Sign In</span>
          </a>
        )}
      </div>

    </header>
  );
};

export default Header;
