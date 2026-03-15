import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, TrendingUp, Briefcase, AlertCircle, Heart, Settings, Monitor } from 'lucide-react';
import clsx from 'clsx';

interface SidebarProps {
  isOpen: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen }) => {
  const location = useLocation();

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/' },
    { icon: Monitor, label: 'Market Monitor', href: '/market-monitor' },
    { icon: TrendingUp, label: 'Arbitrage', href: '/arbitrage' },
    { icon: Briefcase, label: 'Portfolio', href: '/portfolio' },
    { icon: Heart, label: 'Watchlist', href: '/watchlist' },
    { icon: AlertCircle, label: 'Alerts', href: '/alerts' },
    { icon: Settings, label: 'Settings', href: '/settings' },
  ];

  return (
    <aside
      className={clsx(
        'bg-carbon-800/50 backdrop-blur-xl border-r border-white/[0.06] transition-all duration-300 overflow-y-auto flex flex-col',
        isOpen ? 'w-60' : 'w-[72px]'
      )}
    >
      <nav className="p-3 space-y-1 flex-1 mt-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href;

          return (
            <Link
              key={item.href}
              to={item.href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group',
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
      </nav>

      {/* Bottom branding */}
      {isOpen && (
        <div className="p-4 border-t border-white/[0.04]">
          <p className="text-[10px] text-gray-600 font-mono uppercase tracking-widest">v1.0.0 • Pro</p>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
