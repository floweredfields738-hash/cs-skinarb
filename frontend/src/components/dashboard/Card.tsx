import React from 'react';
import clsx from 'clsx';
import AnimatedNumber from '../common/AnimatedNumber';

interface CardProps {
  title: string;
  value: string | number;
  change?: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

const Card: React.FC<CardProps> = ({ title, value, change, icon, className }) => {
  const changeNum = change ? parseFloat(change) : 0;
  const isPositive = changeNum >= 0;

  return (
    <div className={clsx('glass-panel-hover p-5 group', className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">{title}</p>
          <h3 className="text-2xl font-bold text-white mt-2 font-mono tracking-tight live-value">
            {typeof value === 'string' && value.startsWith('$') && !isNaN(parseFloat(value.replace(/[$,]/g, '')))
              ? <AnimatedNumber value={parseFloat(value.replace(/[$,]/g, ''))} prefix="$" decimals={2} />
              : typeof value === 'number'
                ? <AnimatedNumber value={value} />
                : value}
          </h3>
          {change && (
            <div className="flex items-center gap-1.5 mt-2">
              <div className={clsx(
                'px-1.5 py-0.5 rounded text-[11px] font-bold font-mono',
                isPositive
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-red-500/10 text-red-400'
              )}>
                {isPositive ? '▲' : '▼'} {change}
              </div>
              <span className="text-[10px] text-gray-600">24h</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="p-2.5 rounded-xl bg-cyan-glow/[0.06] text-cyan-glow/60 group-hover:bg-cyan-glow/10 group-hover:text-cyan-glow transition-all duration-300">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};

export default Card;
