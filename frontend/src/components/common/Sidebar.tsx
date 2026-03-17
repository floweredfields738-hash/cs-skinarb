import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, TrendingUp, Briefcase, AlertCircle, Heart, Settings, Monitor, Package, Archive, BookOpen, BarChart3, MessageSquare, Store, Copy } from 'lucide-react';
import { useConnectionStatus } from '../../hooks/useRealTimeData';
import clsx from 'clsx';

interface SidebarProps {
  isOpen: boolean;
  onNavClick?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onNavClick }) => {
  const location = useLocation();
  const connected = useConnectionStatus();

  // Dashboard standalone — not in any group
  const dashboardItem = { icon: LayoutDashboard, label: 'Dashboard', href: '/' };

  const navGroups = [
    {
      label: 'Markets',
      items: [
        { icon: Monitor, label: 'Market Monitor', href: '/market-monitor' },
        { icon: TrendingUp, label: 'Arbitrage', href: '/arbitrage' },
        { icon: Package, label: 'Cases', href: '/cases' },
        { icon: Store, label: 'Marketplace', href: '/marketplace' },
      ],
    },
    {
      label: 'Portfolio',
      items: [
        { icon: Briefcase, label: 'Portfolio', href: '/portfolio' },
        { icon: BookOpen, label: 'Trade Journal', href: '/trades' },
        { icon: Archive, label: 'Inventory', href: '/inventory' },
        { icon: BarChart3, label: 'Calculators', href: '/calculators' },
      ],
    },
    {
      label: 'Tracking',
      items: [
        { icon: Heart, label: 'Watchlist', href: '/watchlist' },
        { icon: AlertCircle, label: 'Alerts', href: '/alerts' },
      ],
    },
    {
      label: 'Community',
      items: [
        { icon: MessageSquare, label: 'Chats', href: '/chats' },
        { icon: Copy, label: 'Copy Trading', href: '/copying' },
      ],
    },
  ];

  return (
    <aside
      className={clsx(
        'bg-carbon-800/50 backdrop-blur-xl border-r border-white/[0.06] transition-all duration-300 overflow-y-auto flex flex-col',
        isOpen ? 'w-60' : 'w-[72px]'
      )}
    >
      {/* Logo */}
      <Link to="/" className="flex items-center gap-3 px-4 py-4 border-b border-white/[0.06]">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-glow flex items-center justify-center shadow-glow-cyan flex-shrink-0">
          <span className="text-carbon-950 font-extrabold text-sm tracking-tight">CS</span>
        </div>
        {isOpen && (
          <div>
            <span className="font-bold text-white text-sm tracking-wide">CSKINARB</span>
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
        )}
      </Link>

      <nav className="p-3 flex-1 mt-1 space-y-3 overflow-y-auto">
        {/* Dashboard — standalone above all groups */}
        {(() => {
          const Icon = dashboardItem.icon;
          const isActive = location.pathname === dashboardItem.href;
          return (
            <Link
              to={dashboardItem.href}
              onClick={onNavClick}
              className={clsx(
                'flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 group mb-2',
                isActive
                  ? 'bg-cyan-glow/10 text-cyan-glow border border-cyan-glow/20'
                  : 'text-gray-500 hover:bg-white/[0.04] hover:text-gray-300 border border-transparent'
              )}
              title={!isOpen ? dashboardItem.label : undefined}
            >
              <Icon className={clsx('w-[18px] h-[18px] flex-shrink-0', isActive ? 'text-cyan-glow' : 'text-gray-500 group-hover:text-gray-300')} />
              {isOpen && <span className={clsx('text-[13px] font-medium tracking-wide', isActive ? 'text-cyan-glow' : '')}>{dashboardItem.label}</span>}
              {isActive && <div className="ml-auto"><div className="neon-dot" style={{ width: '5px', height: '5px' }}></div></div>}
            </Link>
          );
        })()}

        {navGroups.map((group) => (
          <div key={group.label}>
            {isOpen && (
              <p className="text-[9px] text-gray-600 uppercase tracking-[0.15em] font-bold px-3 mb-1.5">{group.label}</p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={onNavClick}
                    className={clsx(
                      'flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 group',
                      isActive
                        ? 'bg-cyan-glow/10 text-cyan-glow border border-cyan-glow/20'
                        : 'text-gray-500 hover:bg-white/[0.04] hover:text-gray-300 border border-transparent'
                    )}
                    title={!isOpen ? item.label : undefined}
                  >
                    <Icon className={clsx(
                      'w-[18px] h-[18px] flex-shrink-0 transition-all duration-200',
                      isActive ? 'text-cyan-glow' : 'text-gray-500 group-hover:text-gray-300'
                    )} />
                    {isOpen && (
                      <span className={clsx(
                        'text-[13px] font-medium tracking-wide',
                        isActive ? 'text-cyan-glow' : ''
                      )}>
                        {item.label}
                      </span>
                    )}
                    {isActive && (
                      <div className="ml-auto">
                        <div className="neon-dot" style={{ width: '5px', height: '5px' }}></div>
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Settings — pinned to bottom */}
      <div className="p-3 border-t border-white/[0.04]">
        {(() => {
          const isActive = location.pathname === '/settings';
          return (
            <Link
              to="/settings"
              onClick={onNavClick}
              className={clsx(
                'flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 group',
                isActive
                  ? 'bg-cyan-glow/10 text-cyan-glow border border-cyan-glow/20'
                  : 'text-gray-500 hover:bg-white/[0.04] hover:text-gray-300 border border-transparent'
              )}
              title={!isOpen ? 'Settings' : undefined}
            >
              <Settings className={clsx('w-[18px] h-[18px] flex-shrink-0', isActive ? 'text-cyan-glow' : 'text-gray-500 group-hover:text-gray-300')} />
              {isOpen && <span className={clsx('text-[13px] font-medium tracking-wide', isActive ? 'text-cyan-glow' : '')}>Settings</span>}
            </Link>
          );
        })()}
      </div>
    </aside>
  );
};

export default Sidebar;
