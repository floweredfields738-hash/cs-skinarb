import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useLivePriceFeed } from '../../hooks/useRealTimeData';
import AnimatedNumber from './AnimatedNumber';

const LiveTicker: React.FC = () => {
  const feed = useLivePriceFeed(30);

  if (feed.length < 3) {
    return (
      <div className="flex items-center gap-2 text-xs font-mono">
        <span
          className="inline-block w-2 h-2 rounded-full bg-cyan-glow/60"
          style={{ animation: 'pulse 1.5s ease-in-out infinite' }}
        ></span>
        <span className="text-gray-500">Loading market data...</span>
      </div>
    );
  }

  // Duplicate the feed so it loops seamlessly
  const items = [...feed, ...feed];

  return (
    <div className="ticker-marquee-container">
      <div className="ticker-marquee">
        {items.map((item, idx) => (
          <div key={`${item.skinName}-${idx}`} className="ticker-marquee-item">
            {item.changePercent >= 0 ? (
              <TrendingUp className="w-3 h-3 text-emerald-400/70 flex-shrink-0" />
            ) : (
              <TrendingDown className="w-3 h-3 text-red-400/70 flex-shrink-0" />
            )}
            <span className="text-gray-400 whitespace-nowrap">
              {item.skinName}
            </span>
            <AnimatedNumber
              value={item.newPrice}
              prefix="$"
              decimals={2}
              duration={400}
              className="text-white font-semibold whitespace-nowrap"
            />
            <span
              className={`whitespace-nowrap ${
                item.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {item.changePercent >= 0 ? '+' : ''}
              {item.changePercent?.toFixed(1)}%
            </span>
            <div className="w-px h-3 bg-white/[0.08] mx-1 flex-shrink-0"></div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LiveTicker;
