import React, { useRef, useEffect, useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { TrendingUp, TrendingDown, ExternalLink, X } from 'lucide-react';
import { useLivePriceFeed } from '../../hooks/useRealTimeData';

interface TickerItem {
  skinName: string;
  skinId?: number;
  newPrice: number;
  oldPrice?: number;
  changePercent: number;
  marketName?: string;
}

const LiveTicker: React.FC = () => {
  const feed = useLivePriceFeed(60);
  const [items, setItems] = useState<TickerItem[]>([]);
  const [popup, setPopup] = useState<{ item: TickerItem; x: number; y: number } | null>(null);
  const initialized = useRef(false);
  const marqueeRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const animApplied = useRef(false);

  // Only set items ONCE on initial load — never re-render the ticker after that
  // This prevents the CSS animation from restarting and causing stutter
  useEffect(() => {
    if (!initialized.current && feed.length >= 10) {
      setItems([...feed]);
      initialized.current = true;
    }
  }, [feed]);

  // CSS animation — apply ONCE, never recalculate, runs on GPU compositor thread
  useEffect(() => {
    if (animApplied.current) return; // Never re-apply
    const el = marqueeRef.current;
    if (!el || items.length === 0) return;

    // Wait for layout
    requestAnimationFrame(() => {
      const halfWidth = el.scrollWidth / 2;
      if (halfWidth <= 0) return;

      const speed = 90; // pixels per second
      const duration = halfWidth / speed;
      el.style.animation = `tickerSlide ${duration}s linear infinite`;
      animApplied.current = true;
    });
  }, [items]);

  // Pause/resume via ref (no re-render, no animation restart)
  useEffect(() => {
    pausedRef.current = !!popup;
    if (marqueeRef.current) {
      marqueeRef.current.style.animationPlayState = popup ? 'paused' : 'running';
    }
  }, [popup]);

  // Close popup on outside click
  useEffect(() => {
    if (!popup) return;
    const close = () => setPopup(null);
    const timer = setTimeout(() => document.addEventListener('click', close), 50);
    return () => { clearTimeout(timer); document.removeEventListener('click', close); };
  }, [popup]);

  const handleItemClick = (e: React.MouseEvent, item: TickerItem) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPopup({
      item,
      x: Math.min(rect.left, window.innerWidth - 320),
      y: rect.bottom + 8,
    });
  };

  // Memoize so the ticker DOM never re-renders (prevents animation restart)
  const displayItems = useMemo(() => [...items, ...items], [items]);

  if (items.length < 3) {
    return (
      <div className="flex items-center gap-2 text-xs font-mono">
        <span className="inline-block w-2 h-2 rounded-full bg-cyan-glow/60" style={{ animation: 'pulse 1.5s ease-in-out infinite' }}></span>
        <span className="text-gray-500">Loading market data...</span>
      </div>
    );
  }

  const generateSearchUrl = (name: string) => {
    const baseName = name.replace(/\s*\([^)]*\)$/, '').trim();
    return `https://steamcommunity.com/market/search?appid=730&q=${encodeURIComponent(baseName)}`;
  };

  return (
    <>
      <div className="ticker-marquee-container">
        <div className="ticker-marquee" ref={marqueeRef}>
          {displayItems.map((item, idx) => (
            <div
              key={`${item.skinName}-${idx}`}
              className="ticker-marquee-item cursor-pointer hover:bg-white/[0.04] rounded px-2 py-1 -my-1 transition-colors"
              onClick={(e) => handleItemClick(e, item)}
            >
              {item.changePercent >= 0 ? (
                <TrendingUp className="w-3 h-3 text-emerald-400/70 flex-shrink-0" />
              ) : (
                <TrendingDown className="w-3 h-3 text-red-400/70 flex-shrink-0" />
              )}
              <span className="text-gray-400 whitespace-nowrap">{item.skinName}</span>
              <span className="text-white font-semibold whitespace-nowrap">${item.newPrice?.toFixed(2)}</span>
              <span className={`whitespace-nowrap ${item.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {item.changePercent >= 0 ? '+' : ''}{item.changePercent?.toFixed(1)}%
              </span>
              <div className="w-px h-3 bg-white/[0.08] mx-1 flex-shrink-0"></div>
            </div>
          ))}
        </div>
      </div>

      {/* Popup dropdown */}
      {popup && ReactDOM.createPortal(
        <>
          <div className="fixed inset-0" style={{ zIndex: 99998 }} onClick={() => setPopup(null)} />
          <div
            className="fixed glass-panel border border-white/[0.08] shadow-2xl p-4 w-[300px]"
            style={{ zIndex: 99999, top: popup.y, left: popup.x }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white truncate pr-2">{popup.item.skinName}</h3>
              <button onClick={() => setPopup(null)} className="text-gray-600 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Price info */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <p className="text-[9px] text-gray-500 uppercase tracking-widest font-mono mb-0.5">Price</p>
                <p className="text-lg font-bold text-white font-mono">${popup.item.newPrice?.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[9px] text-gray-500 uppercase tracking-widest font-mono mb-0.5">Change</p>
                <p className={`text-lg font-bold font-mono ${popup.item.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {popup.item.changePercent >= 0 ? '+' : ''}{popup.item.changePercent?.toFixed(2)}%
                </p>
              </div>
            </div>

            {popup.item.oldPrice != null && (
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <p className="text-[9px] text-gray-500 uppercase tracking-widest font-mono mb-0.5">Previous</p>
                  <p className="text-sm text-gray-300 font-mono">${popup.item.oldPrice?.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-gray-500 uppercase tracking-widest font-mono mb-0.5">Difference</p>
                  <p className={`text-sm font-mono ${(popup.item.newPrice - (popup.item.oldPrice || 0)) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {(popup.item.newPrice - (popup.item.oldPrice || 0)) >= 0 ? '+' : ''}${(popup.item.newPrice - (popup.item.oldPrice || 0)).toFixed(2)}
                  </p>
                </div>
              </div>
            )}

            {popup.item.marketName && (
              <div className="mb-3">
                <p className="text-[9px] text-gray-500 uppercase tracking-widest font-mono mb-0.5">Market</p>
                <p className="text-sm text-cyan-glow font-medium">{popup.item.marketName}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t border-white/[0.04]">
              {popup.item.skinId && (
                <a
                  href={`/skins/${popup.item.skinId}`}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-glow/[0.08] text-cyan-glow text-[11px] font-bold border border-cyan-glow/20 hover:bg-cyan-glow/[0.15] transition-all"
                >
                  View Details
                </a>
              )}
              <a
                href={generateSearchUrl(popup.item.skinName)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.04] text-gray-300 text-[11px] font-bold border border-white/[0.08] hover:bg-white/[0.08] transition-all"
              >
                <ExternalLink className="w-3 h-3" />
                Steam Market
              </a>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
};

export default LiveTicker;
