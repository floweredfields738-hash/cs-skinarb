import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Activity, ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react';
import { useMarketIndex } from '../../hooks/useRealTimeData';
import AnimatedNumber from '../common/AnimatedNumber';

function clsx(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

type TimeRange = '1H' | '6H' | '12H' | '24H' | '1W' | 'ALL';

const RANGE_MS: Record<TimeRange, number> = {
  '1H': 60 * 60 * 1000,
  '6H': 6 * 60 * 60 * 1000,
  '12H': 12 * 60 * 60 * 1000,
  '24H': 24 * 60 * 60 * 1000,
  '1W': 7 * 24 * 60 * 60 * 1000,
  'ALL': Infinity,
};

const RANGE_PERCENT: Record<TimeRange, number> = {
  '1H': 0.08,
  '6H': 0.20,
  '12H': 0.40,
  '24H': 0.65,
  '1W': 0.85,
  'ALL': 1.0,
};

const MarketOverview: React.FC = () => {
  const allPoints = useMarketIndex();
  const [selectedRange, setSelectedRange] = useState<TimeRange>('ALL');
  const [hoverInfo, setHoverInfo] = useState<{ value: number; time: number; x: number; y: number; change: number; skinCount: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const displayValueRef = useRef(0);
  const displayChangeRef = useRef(0);
  const [displayValue, setDisplayValue] = useState(0);
  const [displayChange, setDisplayChange] = useState(0);

  // Filter by time range
  const points = useMemo(() => {
    if (selectedRange === 'ALL' || allPoints.length === 0) return allPoints;
    const now = Date.now();
    const cutoff = now - RANGE_MS[selectedRange];
    const timeFiltered = allPoints.filter((p) => p.time >= cutoff);
    if (timeFiltered.length >= 2 && timeFiltered.length < allPoints.length * 0.95) return timeFiltered;
    const pct = RANGE_PERCENT[selectedRange];
    const start = Math.max(0, Math.floor(allPoints.length * (1 - pct)));
    const sliced = allPoints.slice(start);
    return sliced.length >= 2 ? sliced : allPoints;
  }, [allPoints, selectedRange]);

  // Window stats
  const windowStats = useMemo(() => {
    if (points.length === 0) return { open: 0, high: 0, low: 0, close: 0, change: 0, skinCount: 0 };
    const values = points.map((p) => p.totalValue);
    const open = values[0], close = values[values.length - 1];
    return {
      open, close,
      high: Math.max(...values),
      low: Math.min(...values),
      change: open > 0 ? ((close - open) / open) * 100 : 0,
      skinCount: points[points.length - 1].skinCount,
    };
  }, [points]);

  const { open: openValue, high: sessionHigh, low: sessionLow, close: latestValue, change: totalChange, skinCount } = windowStats;
  const isPositive = totalChange >= 0;

  // Smooth lerp
  useEffect(() => {
    if (latestValue <= 0) return;
    displayValueRef.current = latestValue;
    displayChangeRef.current = totalChange;
  }, [latestValue, totalChange]);

  useEffect(() => {
    let running = true;
    const tick = () => {
      if (!running) return;
      setDisplayValue((prev) => {
        if (displayValueRef.current === 0) return prev;
        return prev + (displayValueRef.current - prev) * 0.08;
      });
      setDisplayChange((prev) => prev + (displayChangeRef.current - prev) * 0.08);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => { running = false; };
  }, []);

  // Canvas drawing
  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || points.length < 2) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const pad = { top: 15, right: 65, bottom: 28, left: 8 };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;

    const values = points.map((p) => p.totalValue);
    const vMin = Math.min(...values);
    const vMax = Math.max(...values);
    const vRange = vMax - vMin || 1;
    const yPad = vRange * 0.08;
    const yMin = vMin - yPad;
    const yMax = vMax + yPad;
    const yRange = yMax - yMin;

    const toX = (i: number) => pad.left + (i / (points.length - 1)) * plotW;
    const toY = (v: number) => pad.top + (1 - (v - yMin) / yRange) * plotH;

    // Format large dollar values
    const fmtVal = (v: number) => {
      if (v >= 1000000) return '$' + (v / 1000000).toFixed(2) + 'M';
      if (v >= 1000) return '$' + (v / 1000).toFixed(1) + 'K';
      return '$' + v.toFixed(0);
    };

    // Grid lines + Y labels
    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const val = yMin + (yRange * i) / 4;
      const y = toY(val);
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(W - pad.right, y);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.font = '9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(fmtVal(val), W - pad.right + 6, y + 3);
    }

    // X time labels
    const xIndices = [0, Math.floor(points.length * 0.25), Math.floor(points.length * 0.5), Math.floor(points.length * 0.75), points.length - 1];
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    for (const idx of xIndices) {
      const t = new Date(points[idx].time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      ctx.fillText(t, toX(idx), H - 8);
    }

    // Gradient fill
    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
    if (isPositive) {
      grad.addColorStop(0, 'rgba(0,229,255,0.10)');
      grad.addColorStop(0.7, 'rgba(0,229,255,0.02)');
      grad.addColorStop(1, 'transparent');
    } else {
      grad.addColorStop(0, 'rgba(248,113,113,0.10)');
      grad.addColorStop(0.7, 'rgba(248,113,113,0.02)');
      grad.addColorStop(1, 'transparent');
    }

    // Smooth bezier curve
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(values[0]));
    for (let i = 1; i < values.length; i++) {
      const x0 = toX(i - 1), y0 = toY(values[i - 1]);
      const x1 = toX(i), y1 = toY(values[i]);
      const cpx = (x0 + x1) / 2;
      ctx.bezierCurveTo(cpx, y0, cpx, y1, x1, y1);
    }
    // Fill area
    ctx.lineTo(toX(values.length - 1), pad.top + plotH);
    ctx.lineTo(toX(0), pad.top + plotH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Draw line
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(values[0]));
    for (let i = 1; i < values.length; i++) {
      const x0 = toX(i - 1), y0 = toY(values[i - 1]);
      const x1 = toX(i), y1 = toY(values[i]);
      const cpx = (x0 + x1) / 2;
      ctx.bezierCurveTo(cpx, y0, cpx, y1, x1, y1);
    }
    ctx.strokeStyle = isPositive ? '#00e5ff' : '#f87171';
    ctx.lineWidth = 2;
    ctx.shadowColor = isPositive ? 'rgba(0,229,255,0.4)' : 'rgba(248,113,113,0.4)';
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Current value dashed line
    if (latestValue > 0) {
      const curY = toY(latestValue);
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = isPositive ? 'rgba(0,229,255,0.15)' : 'rgba(248,113,113,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.left, curY);
      ctx.lineTo(W - pad.right, curY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Current value label on right
      ctx.fillStyle = isPositive ? 'rgba(0,229,255,0.15)' : 'rgba(248,113,113,0.15)';
      ctx.beginPath();
      ctx.roundRect(W - pad.right + 2, curY - 10, pad.right - 6, 20, 3);
      ctx.fill();
      ctx.fillStyle = isPositive ? '#00e5ff' : '#f87171';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(fmtVal(latestValue), W - pad.right + 6, curY + 3);
    }

    // Pulsing dot at latest
    const lastX = toX(values.length - 1);
    const lastY = toY(values[values.length - 1]);
    const pulsePhase = (Date.now() % 2000) / 2000;
    const pulseR = 4 + Math.sin(pulsePhase * Math.PI * 2) * 3;

    ctx.beginPath();
    ctx.arc(lastX, lastY, pulseR, 0, Math.PI * 2);
    ctx.fillStyle = isPositive ? `rgba(0,229,255,0.12)` : `rgba(248,113,113,0.12)`;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
    ctx.fillStyle = isPositive ? '#00e5ff' : '#f87171';
    ctx.fill();

    // Hover crosshair
    if (hoverInfo) {
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hoverInfo.x, pad.top);
      ctx.lineTo(hoverInfo.x, pad.top + plotH);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pad.left, hoverInfo.y);
      ctx.lineTo(W - pad.right, hoverInfo.y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.arc(hoverInfo.x, hoverInfo.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'white';
      ctx.fill();
      ctx.strokeStyle = isPositive ? '#00e5ff' : '#f87171';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Value label
      ctx.fillStyle = isPositive ? 'rgba(0,229,255,0.2)' : 'rgba(248,113,113,0.2)';
      ctx.beginPath();
      ctx.roundRect(W - pad.right + 2, hoverInfo.y - 10, pad.right - 6, 20, 3);
      ctx.fill();
      ctx.fillStyle = 'white';
      ctx.font = '9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(fmtVal(hoverInfo.value), W - pad.right + 6, hoverInfo.y + 3);

      // Time label
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath();
      ctx.roundRect(hoverInfo.x - 28, pad.top + plotH + 2, 56, 15, 3);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        new Date(hoverInfo.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
        hoverInfo.x, pad.top + plotH + 12
      );
    }
  }, [points, isPositive, latestValue, hoverInfo]);

  // 60fps animation loop
  useEffect(() => {
    let running = true;
    const loop = () => {
      if (!running) return;
      drawChart();
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(animFrameRef.current); };
  }, [drawChart]);

  // Hover
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || points.length < 2) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const W = rect.width;
    const pad = { left: 8, right: 65 };
    const plotW = W - pad.left - pad.right;

    let closest = 0, closestDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const px = pad.left + (i / (points.length - 1)) * plotW;
      if (Math.abs(px - mouseX) < closestDist) { closestDist = Math.abs(px - mouseX); closest = i; }
    }

    const p = points[closest];
    const values = points.map((pt) => pt.totalValue);
    const vMin = Math.min(...values), vMax = Math.max(...values);
    const vRange = vMax - vMin || 1;
    const yPad = vRange * 0.08;
    const yMin = vMin - yPad, yMax2 = vMax + yPad, yRange = yMax2 - yMin;
    const H = rect.height;
    const padTop = 15, padBottom = 28, plotH = H - padTop - padBottom;

    setHoverInfo({
      value: p.totalValue,
      time: p.time,
      x: pad.left + (closest / (points.length - 1)) * plotW,
      y: padTop + (1 - (p.totalValue - yMin) / yRange) * plotH,
      change: openValue > 0 ? ((p.totalValue - openValue) / openValue) * 100 : 0,
      skinCount: p.skinCount,
    });
  }, [points, openValue]);

  const handleMouseLeave = () => setHoverInfo(null);

  const shownValue = hoverInfo ? hoverInfo.value : displayValue;
  const shownChange = hoverInfo ? hoverInfo.change : displayChange;
  const shownIsPositive = shownChange >= 0;

  const fmtBig = (v: number) => {
    if (v >= 1000000) return '$' + (v / 1000000).toFixed(2) + 'M';
    if (v >= 1000) return '$' + (v / 1000).toFixed(1) + 'K';
    return '$' + v.toFixed(2);
  };

  return (
    <div className="glass-panel p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-glow/[0.08]">
            <Activity className="w-4 h-4 text-cyan-glow" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">CS2 Market Index</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[11px] text-gray-500 font-mono">Total Market Value</p>
              {skinCount > 0 && (
                <span className="text-[10px] text-gray-600 font-mono">{skinCount} skins tracked</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden lg:flex items-center gap-3 text-[10px] font-mono">
            {openValue > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-gray-600 uppercase">Open</span>
                <span className="text-gray-400">{fmtBig(openValue)}</span>
              </div>
            )}
            {sessionHigh > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-gray-600 uppercase">High</span>
                <span className="text-emerald-400/70">{fmtBig(sessionHigh)}</span>
              </div>
            )}
            {sessionLow > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-gray-600 uppercase">Low</span>
                <span className="text-red-400/70">{fmtBig(sessionLow)}</span>
              </div>
            )}
          </div>

          <div className="text-right">
            <span className="text-xl font-bold font-mono text-white live-value">
              {displayValue > 0
                ? <AnimatedNumber value={shownValue} prefix="$" decimals={2} duration={400} />
                : <span className="text-gray-500">—</span>}
            </span>
            <div className="flex items-center justify-end gap-0.5 mt-0.5">
              <div className={clsx(
                'flex items-center gap-0.5 px-1.5 py-0.5 rounded',
                shownIsPositive ? 'bg-emerald-500/10' : 'bg-red-500/10'
              )}>
                {shownIsPositive
                  ? <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                  : <ArrowDownRight className="w-3 h-3 text-red-400" />}
                <span className={clsx(
                  'text-[11px] font-bold font-mono',
                  shownIsPositive ? 'text-emerald-400' : 'text-red-400'
                )}>
                  {shownIsPositive ? '+' : ''}{shownChange.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Canvas Chart */}
      <div
        ref={containerRef}
        className="relative rounded-xl bg-carbon-900/60 border border-white/[0.03] overflow-hidden"
        style={{ height: 280 }}
      >
        {points.length < 2 ? (
          <div className="flex items-center justify-center h-full gap-2">
            <div className="neon-dot" style={{ width: '6px', height: '6px', animation: 'smoothPulse 1.5s infinite' }}></div>
            <span className="text-sm text-gray-500 font-mono">Calculating market index...</span>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className="w-full h-full cursor-crosshair"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          />
        )}
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-1">
          {(['1H', '6H', '12H', '24H', '1W', 'ALL'] as TimeRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setSelectedRange(r)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-[11px] font-bold font-mono transition-all duration-200',
                r === selectedRange
                  ? 'bg-cyan-glow/10 text-cyan-glow border border-cyan-glow/20'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04] border border-transparent'
              )}
            >
              {r}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 text-[10px] font-mono text-gray-600">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{allPoints.length} data points</span>
          </div>
          {latestValue > 0 && openValue > 0 && (
            <span className={shownIsPositive ? 'text-emerald-400/50' : 'text-red-400/50'}>
              {shownIsPositive ? '▲' : '▼'} {fmtBig(Math.abs(latestValue - openValue))}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default MarketOverview;
