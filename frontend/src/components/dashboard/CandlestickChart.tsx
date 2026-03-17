import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Activity } from 'lucide-react';
import { marketApi } from '../../api/services';

// ── Types ────────────────────────────────────────────────────────────────────

interface Candle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface CandlestickChartProps {
  skinId: number;
  marketId?: number;
  skinName?: string;
  initialInterval?: string;
  height?: number;
  showIntervalSelector?: boolean;
  showVolume?: boolean;
  className?: string;
  /** When true, fetches market index candles instead of per-skin candles */
  indexMode?: boolean;
}

// ── Constants ────────────────────────────────────────────────────────────────

const INTERVALS = [
  { key: '1h', label: '1H' },
  { key: '4h', label: '4H' },
  { key: '1d', label: '1D' },
  { key: '1w', label: '1W' },
];

const COLORS = {
  bullish: '#10b981',      // emerald-500
  bullishFill: '#10b98140',
  bearish: '#ef4444',      // red-500
  bearishFill: '#ef444440',
  wick: '#6b728080',
  grid: 'rgba(255,255,255,0.03)',
  axis: 'rgba(255,255,255,0.15)',
  axisText: '#6b7280',     // gray-500
  tooltipBg: 'rgba(10,12,18,0.95)',
  tooltipBorder: 'rgba(0,229,255,0.2)',
  cyan: '#00e5ff',
  volumeUp: '#10b98130',
  volumeDown: '#ef444430',
};

// ── Padding / layout ────────────────────────────────────────────────────────

const PADDING = { top: 16, right: 64, bottom: 40, left: 12 };
const VOLUME_HEIGHT_RATIO = 0.18;

// ── Market overlay colors ────────────────────────────────────────────────────

const MARKET_LINE_COLORS: Record<number, { color: string; name: string }> = {
  1: { color: '#4a90d9', name: 'Steam' },
  2: { color: '#f5a623', name: 'Buff163' },
  3: { color: '#9b59b6', name: 'Skinport' },
  4: { color: '#2ecc71', name: 'CSFloat' },
};

interface MarketOverlay {
  marketId: number;
  name: string;
  color: string;
  candles: Candle[];
}

// ── Format helpers ───────────────────────────────────────────────────────────

function formatPrice(n: number): string {
  if (n >= 1000) return `$${n.toFixed(0)}`;
  if (n >= 100) return `$${n.toFixed(1)}`;
  return `$${n.toFixed(2)}`;
}

function formatTime(ts: string, interval: string): string {
  const d = new Date(ts);
  if (interval === '1w' || interval === '1d') {
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${h}:${m}`;
}

function formatTooltipTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Component ────────────────────────────────────────────────────────────────

const CandlestickChart: React.FC<CandlestickChartProps> = ({
  skinId,
  marketId = 1,
  skinName,
  initialInterval = '1d',
  height = 420,
  showIntervalSelector = true,
  showVolume = true,
  className = '',
  indexMode = false,
}) => {
  const [interval, setInterval_] = useState(initialInterval);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [overlays, setOverlays] = useState<MarketOverlay[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [showOverlays, setShowOverlays] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: height || 420 });

  // Responsive resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        if (w > 0) {
          setDimensions({ width: w, height: h > 100 ? h : (height || 420) });
        }
      }
    });

    observer.observe(container);
    // Initial measurement
    setDimensions({ width: container.clientWidth || 800, height });

    return () => observer.disconnect();
  }, [height]);

  // Fetch candle data
  useEffect(() => {
    setLoading(true);

    if (indexMode) {
      // Fetch market index candles (aggregate across all markets)
      const apiUrl = '/api';
      fetch(`${apiUrl}/market/index-candles?interval=${interval}&limit=200`)
        .then(r => r.json())
        .then(data => {
          const candles = data?.data?.candles || [];
          setCandles(candles.length >= 2 ? candles : []);
          setOverlays([]);
        })
        .catch(() => setCandles([]))
        .finally(() => setLoading(false));
      return;
    }

    if (!skinId) { setLoading(false); return; }

    // Fetch primary market candles
    const primaryFetch = marketApi.getCandles({ skin_id: skinId, market_id: marketId, interval, limit: 100 })
      .then((res) => {
        const data = res.data?.data?.candles || res.data?.candles || [];
        setCandles(data.length >= 2 ? data : []);
      })
      .catch(() => setCandles([]));

    // Fetch overlay candles for other markets
    const otherMarkets = [1, 3, 4].filter(id => id !== marketId);
    const overlayFetches = otherMarkets.map(mId =>
      marketApi.getCandles({ skin_id: skinId, market_id: mId, interval, limit: 100 })
        .then((res) => {
          const data = res.data?.data?.candles || res.data?.candles || [];
          if (data.length >= 2) {
            const info = MARKET_LINE_COLORS[mId] || { color: '#888', name: `Market ${mId}` };
            return { marketId: mId, name: info.name, color: info.color, candles: data } as MarketOverlay;
          }
          return null;
        })
        .catch(() => null)
    );

    Promise.all([primaryFetch, ...overlayFetches])
      .then(([_, ...results]) => {
        setOverlays(results.filter(Boolean) as MarketOverlay[]);
      })
      .finally(() => setLoading(false));
  }, [skinId, marketId, interval, indexMode]);

  // ── Derived chart calculations ─────────────────────────────────────────────

  const chartArea = useMemo(() => ({
    x: PADDING.left,
    y: PADDING.top,
    width: dimensions.width - PADDING.left - PADDING.right,
    height: dimensions.height - PADDING.top - PADDING.bottom,
  }), [dimensions]);

  const priceArea = useMemo(() => ({
    ...chartArea,
    height: showVolume ? chartArea.height * (1 - VOLUME_HEIGHT_RATIO) : chartArea.height,
  }), [chartArea, showVolume]);

  const volumeArea = useMemo(() => ({
    x: chartArea.x,
    y: priceArea.y + priceArea.height,
    width: chartArea.width,
    height: chartArea.height * VOLUME_HEIGHT_RATIO,
  }), [chartArea, priceArea]);

  const { priceMin, priceMax, volMax, candleWidth, gap } = useMemo(() => {
    if (candles.length === 0) return { priceMin: 0, priceMax: 1, volMax: 1, candleWidth: 6, gap: 2 };

    const lows = candles.map(c => c.low);
    const highs = candles.map(c => c.high);
    const vols = candles.map(c => c.volume);

    const pMin = Math.min(...lows);
    const pMax = Math.max(...highs);
    const pRange = pMax - pMin || 1;
    const paddedMin = pMin - pRange * 0.05;
    const paddedMax = pMax + pRange * 0.05;

    const totalWidth = chartArea.width;
    const maxCandleWidth = Math.max(3, Math.floor(totalWidth / candles.length) - 1);
    const cw = Math.min(maxCandleWidth, 16);
    const g = Math.max(1, Math.floor(cw * 0.3));

    return {
      priceMin: paddedMin,
      priceMax: paddedMax,
      volMax: Math.max(...vols) || 1,
      candleWidth: cw,
      gap: g,
    };
  }, [candles, chartArea.width]);

  // Map price to y coordinate
  const priceToY = useCallback((price: number): number => {
    const ratio = (price - priceMin) / (priceMax - priceMin || 1);
    return priceArea.y + priceArea.height - ratio * priceArea.height;
  }, [priceMin, priceMax, priceArea]);

  // Map candle index to x coordinate
  const idxToX = useCallback((i: number): number => {
    const totalCandleSpace = candleWidth + gap;
    const totalWidth = candles.length * totalCandleSpace;
    const offset = Math.max(0, chartArea.width - totalWidth);
    return chartArea.x + offset + i * totalCandleSpace + candleWidth / 2;
  }, [candles.length, candleWidth, gap, chartArea]);

  // ── Mouse handlers ─────────────────────────────────────────────────────────

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg || candles.length === 0) return;

    const rect = svg.getBoundingClientRect();
    // Scale mouse position from pixel space to viewBox coordinate space
    const scaleX = dimensions.width / rect.width;
    const scaleY = dimensions.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    // Find closest candle
    let closest = 0;
    let closestDist = Infinity;
    for (let i = 0; i < candles.length; i++) {
      const cx = idxToX(i);
      const dist = Math.abs(mouseX - cx);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    }

    if (closestDist < candleWidth * 3) {
      setHoveredIdx(closest);
      setMousePos({ x: mouseX, y: mouseY });
    } else {
      setHoveredIdx(null);
      setMousePos(null);
    }
  }, [candles, idxToX, candleWidth, dimensions]);

  const handleMouseLeave = useCallback(() => {
    setHoveredIdx(null);
    setMousePos(null);
  }, []);

  // ── Price grid lines ───────────────────────────────────────────────────────

  const gridLines = useMemo(() => {
    const range = priceMax - priceMin;
    if (range <= 0) return [];

    const lines: { y: number; label: string }[] = [];
    const step = niceStep(range, 5);
    const start = Math.ceil(priceMin / step) * step;

    for (let p = start; p <= priceMax; p += step) {
      lines.push({ y: priceToY(p), label: formatPrice(p) });
    }
    return lines;
  }, [priceMin, priceMax, priceToY]);

  // ── Time labels ────────────────────────────────────────────────────────────

  const timeLabels = useMemo(() => {
    if (candles.length === 0) return [];
    const labels: { x: number; label: string }[] = [];
    const step = Math.max(1, Math.floor(candles.length / 8));
    for (let i = 0; i < candles.length; i += step) {
      labels.push({ x: idxToX(i), label: formatTime(candles[i].timestamp, interval) });
    }
    return labels;
  }, [candles, idxToX, interval]);

  // ── Current price info ─────────────────────────────────────────────────────

  const lastCandle = candles.length > 0 ? candles[candles.length - 1] : null;
  const firstCandle = candles.length > 0 ? candles[0] : null;
  const priceChange = lastCandle && firstCandle ? lastCandle.close - firstCandle.open : 0;
  const priceChangePct = firstCandle && firstCandle.open > 0
    ? (priceChange / firstCandle.open) * 100 : 0;

  // ── Tooltip data ───────────────────────────────────────────────────────────

  const tooltipCandle = hoveredIdx !== null ? candles[hoveredIdx] : null;

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={`glass-panel p-6 flex items-center justify-center h-full min-h-[400px] ${className}`}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-cyan-glow/30 border-t-cyan-glow rounded-full animate-spin" />
          <span className="text-[11px] text-gray-500 font-mono">Loading chart data...</span>
        </div>
      </div>
    );
  }

  if (!loading && candles.length === 0) {
    return (
      <div className={`glass-panel p-6 flex items-center justify-center h-full min-h-[200px] ${className}`}>
        <div className="flex flex-col items-center gap-3 text-center">
          <Activity className="w-6 h-6 text-cyan-glow/20" />
          <p className="text-[12px] text-gray-500">No candlestick data yet for this skin</p>
          <p className="text-[10px] text-gray-600 font-mono">Price history is being recorded — chart will appear within an hour</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`glass-panel p-6 flex flex-col h-full min-h-[400px] ${className}`} ref={containerRef}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-glow/[0.08]">
            <Activity className="w-4 h-4 text-cyan-glow" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">
              {skinName ? `${skinName} - Candlestick` : 'Candlestick Chart'}
            </h2>
            <p className="text-[11px] text-gray-500 font-mono mt-0.5">
              OHLC &bull; {candles.length} candles &bull; {interval.toUpperCase()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Current price + change */}
          {lastCandle && (
            <div className="text-right mr-2">
              <div className="text-lg font-bold font-mono text-white">
                ${lastCandle.close.toFixed(2)}
              </div>
              <div className={`text-[11px] font-bold font-mono ${priceChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)} ({priceChangePct >= 0 ? '+' : ''}{priceChangePct.toFixed(2)}%)
              </div>
            </div>
          )}

          {/* Interval selector */}
          {showIntervalSelector && (
            <div className="flex items-center gap-1">
              {INTERVALS.map((iv) => (
                <button
                  key={iv.key}
                  onClick={() => setInterval_(iv.key)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold font-mono transition-all duration-200 ${
                    iv.key === interval
                      ? 'bg-cyan-glow/10 text-cyan-glow border border-cyan-glow/20'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]'
                  }`}
                >
                  {iv.label}
                </button>
              ))}
            </div>
          )}

          {/* Market overlay legend */}
          {overlays.length > 0 && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowOverlays(!showOverlays)}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold font-mono transition-all ${
                  showOverlays
                    ? 'bg-white/[0.06] text-gray-300 border border-white/[0.1]'
                    : 'text-gray-600 hover:text-gray-400'
                }`}
              >
                {showOverlays ? 'Markets' : 'Show Markets'}
              </button>
              {showOverlays && (
                <div className="flex items-center gap-2">
                  {/* Primary market */}
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-2 rounded-sm" style={{ backgroundColor: MARKET_LINE_COLORS[marketId]?.color || '#888' }} />
                    <span className="text-[9px] font-mono text-gray-400">{MARKET_LINE_COLORS[marketId]?.name || 'Primary'}</span>
                  </span>
                  {overlays.map(o => (
                    <span key={o.marketId} className="flex items-center gap-1">
                      <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: o.color }} />
                      <span className="text-[9px] font-mono text-gray-500">{o.name}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* SVG Chart */}
      <div className="relative rounded-xl bg-carbon-900/50 border border-white/[0.03] overflow-hidden flex-1">
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
          preserveAspectRatio="none"
          className="select-none w-full h-full"
          style={{ cursor: hoveredIdx !== null ? 'crosshair' : 'default' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Grid lines */}
          {gridLines.map((line, i) => (
            <g key={`grid-${i}`}>
              <line
                x1={chartArea.x}
                y1={line.y}
                x2={chartArea.x + chartArea.width}
                y2={line.y}
                stroke={COLORS.grid}
                strokeWidth={1}
              />
              <text
                x={dimensions.width - PADDING.right + 8}
                y={line.y + 4}
                fill={COLORS.axisText}
                fontSize={10}
                fontFamily="monospace"
              >
                {line.label}
              </text>
            </g>
          ))}

          {/* Volume separator line */}
          {showVolume && (
            <line
              x1={chartArea.x}
              y1={volumeArea.y}
              x2={chartArea.x + chartArea.width}
              y2={volumeArea.y}
              stroke={COLORS.axis}
              strokeWidth={0.5}
              strokeDasharray="4,4"
            />
          )}

          {/* Time labels */}
          {timeLabels.map((tl, i) => (
            <text
              key={`time-${i}`}
              x={tl.x}
              y={dimensions.height - 8}
              fill={COLORS.axisText}
              fontSize={9}
              fontFamily="monospace"
              textAnchor="middle"
            >
              {tl.label}
            </text>
          ))}

          {/* Candlesticks */}
          {candles.map((candle, i) => {
            const cx = idxToX(i);
            const isBull = candle.close >= candle.open;
            const bodyTop = priceToY(Math.max(candle.open, candle.close));
            const bodyBottom = priceToY(Math.min(candle.open, candle.close));
            const bodyHeight = Math.max(1, bodyBottom - bodyTop);
            const wickTop = priceToY(candle.high);
            const wickBottom = priceToY(candle.low);
            const color = isBull ? COLORS.bullish : COLORS.bearish;
            const fillColor = isBull ? COLORS.bullishFill : COLORS.bearishFill;
            const isHovered = hoveredIdx === i;

            return (
              <g key={`candle-${i}`} opacity={isHovered ? 1 : 0.9}>
                {/* Wick */}
                <line
                  x1={cx}
                  y1={wickTop}
                  x2={cx}
                  y2={wickBottom}
                  stroke={color}
                  strokeWidth={1}
                />
                {/* Body */}
                <rect
                  x={cx - candleWidth / 2}
                  y={bodyTop}
                  width={candleWidth}
                  height={bodyHeight}
                  fill={isBull ? fillColor : color}
                  stroke={color}
                  strokeWidth={1}
                  rx={1}
                />
                {/* Hover highlight */}
                {isHovered && (
                  <rect
                    x={cx - candleWidth / 2 - 2}
                    y={bodyTop - 2}
                    width={candleWidth + 4}
                    height={bodyHeight + 4}
                    fill="none"
                    stroke={COLORS.cyan}
                    strokeWidth={1.5}
                    rx={2}
                    opacity={0.6}
                  />
                )}
              </g>
            );
          })}

          {/* Cross-market overlay lines */}
          {showOverlays && overlays.map((overlay) => {
            // Map overlay candle timestamps to our primary candle x positions
            const overlayMap = new Map<string, number>();
            overlay.candles.forEach(c => {
              const ts = new Date(c.timestamp).getTime();
              overlayMap.set(String(ts), c.close);
            });

            // Build path points by matching timestamps
            const points: { x: number; y: number }[] = [];
            candles.forEach((primaryCandle, i) => {
              const ts = new Date(primaryCandle.timestamp).getTime();
              // Find closest overlay candle within 1 interval
              let bestPrice: number | null = null;
              let bestDist = Infinity;
              for (const oc of overlay.candles) {
                const ots = new Date(oc.timestamp).getTime();
                const dist = Math.abs(ots - ts);
                if (dist < bestDist) {
                  bestDist = dist;
                  bestPrice = oc.close;
                }
              }
              if (bestPrice !== null && bestDist < 86400000) { // Within 24h
                const x = idxToX(i);
                const y = priceToY(bestPrice);
                points.push({ x, y });
              }
            });

            if (points.length < 2) return null;

            const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

            return (
              <g key={`overlay-${overlay.marketId}`}>
                <path
                  d={pathD}
                  fill="none"
                  stroke={overlay.color}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.7}
                />
                {/* End label */}
                {points.length > 0 && (
                  <text
                    x={points[points.length - 1].x + 6}
                    y={points[points.length - 1].y + 3}
                    fill={overlay.color}
                    fontSize={9}
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight={600}
                    opacity={0.8}
                  >
                    {overlay.name}
                  </text>
                )}
              </g>
            );
          })}

          {/* Volume bars */}
          {showVolume && candles.map((candle, i) => {
            const cx = idxToX(i);
            const isBull = candle.close >= candle.open;
            const barHeight = (candle.volume / volMax) * volumeArea.height;
            const barY = volumeArea.y + volumeArea.height - barHeight;

            return (
              <rect
                key={`vol-${i}`}
                x={cx - candleWidth / 2}
                y={barY}
                width={candleWidth}
                height={barHeight}
                fill={isBull ? COLORS.volumeUp : COLORS.volumeDown}
                rx={1}
              />
            );
          })}

          {/* Crosshair on hover — follows cursor exactly */}
          {hoveredIdx !== null && mousePos && (
            <>
              {/* Vertical line snapped to nearest candle */}
              <line
                x1={idxToX(hoveredIdx)}
                y1={chartArea.y}
                x2={idxToX(hoveredIdx)}
                y2={chartArea.y + chartArea.height}
                stroke={COLORS.cyan}
                strokeWidth={0.5}
                strokeDasharray="3,3"
                opacity={0.5}
              />
              {/* Horizontal line follows cursor Y exactly */}
              <line
                x1={chartArea.x}
                y1={mousePos.y}
                x2={chartArea.x + chartArea.width}
                y2={mousePos.y}
                stroke={COLORS.cyan}
                strokeWidth={0.5}
                strokeDasharray="3,3"
                opacity={0.5}
              />
              {/* Price label on right axis at cursor Y */}
              {mousePos.y >= chartArea.y && mousePos.y <= chartArea.y + chartArea.height && (
                <>
                  <rect
                    x={chartArea.x + chartArea.width + 2}
                    y={mousePos.y - 9}
                    width={PADDING.right - 6}
                    height={18}
                    rx={4}
                    fill={COLORS.cyan}
                    opacity={0.9}
                  />
                  <text
                    x={chartArea.x + chartArea.width + PADDING.right / 2}
                    y={mousePos.y + 4}
                    textAnchor="middle"
                    fill="#000"
                    fontSize={10}
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight={700}
                  >
                    {formatPrice(priceMin + (priceMax - priceMin) * (1 - (mousePos.y - chartArea.y) / chartArea.height))}
                  </text>
                </>
              )}
            </>
          )}
        </svg>

        {/* Tooltip overlay — snaps to candle, flips side to never block view */}
        {tooltipCandle && hoveredIdx !== null && (
          <div
            className="absolute pointer-events-none z-50 transition-all duration-75"
            style={(() => {
              const candleX = idxToX(hoveredIdx);
              const tooltipWidth = 180;
              const tooltipHeight = 180;
              // Flip to left side if candle is in right half of chart
              const showLeft = candleX > dimensions.width / 2;
              const left = showLeft
                ? candleX - tooltipWidth - 16
                : candleX + 16;
              // Keep tooltip vertically within bounds
              const top = Math.max(8, Math.min(mousePos?.y ? mousePos.y - tooltipHeight / 2 : 60, dimensions.height - tooltipHeight - 8));
              return { left: Math.max(4, left), top };
            })()}
          >
            <div
              className="rounded-xl p-3 backdrop-blur-xl border shadow-2xl"
              style={{
                background: COLORS.tooltipBg,
                borderColor: COLORS.tooltipBorder,
                minWidth: 170,
              }}
            >
              <div className="text-[10px] text-gray-400 font-mono mb-2">
                {formatTooltipTime(tooltipCandle.timestamp)}
              </div>
              <div className="space-y-1">
                {[
                  { label: 'O', value: tooltipCandle.open, color: '#9ca3af' },
                  { label: 'H', value: tooltipCandle.high, color: COLORS.bullish },
                  { label: 'L', value: tooltipCandle.low, color: COLORS.bearish },
                  { label: 'C', value: tooltipCandle.close, color: tooltipCandle.close >= tooltipCandle.open ? COLORS.bullish : COLORS.bearish },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center justify-between gap-4">
                    <span className="text-[10px] font-mono font-bold" style={{ color }}>{label}</span>
                    <span className="text-[11px] font-mono text-white">${value.toFixed(2)}</span>
                  </div>
                ))}
                <div className="border-t border-white/[0.06] pt-1 mt-1">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[10px] font-mono text-gray-500">Vol</span>
                    <span className="text-[11px] font-mono text-gray-300">{tooltipCandle.volume.toLocaleString()}</span>
                  </div>
                </div>
                {/* Change */}
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[10px] font-mono text-gray-500">Chg</span>
                  <span
                    className="text-[11px] font-mono font-bold"
                    style={{ color: tooltipCandle.close >= tooltipCandle.open ? COLORS.bullish : COLORS.bearish }}
                  >
                    {tooltipCandle.close >= tooltipCandle.open ? '+' : ''}
                    {((tooltipCandle.close - tooltipCandle.open) / tooltipCandle.open * 100).toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Utility: compute a "nice" step for grid lines ────────────────────────────

function niceStep(range: number, targetLines: number): number {
  const roughStep = range / targetLines;
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const residual = roughStep / magnitude;

  let niceRes: number;
  if (residual <= 1.5) niceRes = 1;
  else if (residual <= 3.5) niceRes = 2;
  else if (residual <= 7.5) niceRes = 5;
  else niceRes = 10;

  return niceRes * magnitude;
}

export default CandlestickChart;
