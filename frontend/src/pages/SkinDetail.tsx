import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  TrendingDown,
  Star,
  Bell,
  Shield,
  Activity,
  Target,
  BarChart3,
  ExternalLink,
  Award,
  Clock,
  Crosshair,
  Layers,
} from 'lucide-react';
import { useLiveSkinPrices, useLivePriceFeed, useConnectionStatus } from '../hooks/useRealTimeData';
import { skinsApi } from '../api/services';
import CandlestickChart from '../components/dashboard/CandlestickChart';

// ── Fallback Mock Data ───────────────────────────────────────────────────────

const MOCK_SKIN = {
  id: 'ak47-phantom-disruptor-fn',
  name: 'AK-47 | Phantom Disruptor',
  weapon_name: 'AK-47',
  skin_name: 'Phantom Disruptor',
  rarity: 'Covert',
  rarity_color: '#eb4b4b',
  collection: 'Control Collection',
  exterior: 'Factory New',
  float_value: 0.0312,
  float_min: 0.0,
  float_max: 0.5,
  current_price: 142.5,
  previous_price: 127.85,
  change_24h: 8.95,
  price_change_24h: 11.45,
  volume_24h: 487,
  high_24h: 148.2,
  low_24h: 125.6,
  all_time_high: 192.0,
  all_time_low: 68.5,
};

const MOCK_AI_ANALYSIS = {
  opportunityScore: 87,
  recommendation: 'Strong Buy' as const,
  confidence: 92,
  predictedPrice7d: 158.4,
  predictedPrice30d: 178.2,
  reasons: [
    'Price is 12% below 30-day moving average',
    'Volume spike indicates renewed interest',
    'Similar skins in collection trending upward',
    'Float value places this in top 15% of listings',
  ],
};

const MOCK_TECHNICALS = {
  ma7d: 148.6,
  ma30d: 156.2,
  volatility: 14.8,
  trendDirection: 'up' as const,
  rsi: 38.5,
  support: 128.0,
  resistance: 165.0,
};

const MARKET_ID_MAP: Record<number, { name: string; logo: string; fee: number }> = {
  1: { name: 'Steam', logo: '\u{1F7E6}', fee: 13.0 },
  2: { name: 'Buff163', logo: '\u{1F7E7}', fee: 2.5 },
  3: { name: 'Skinport', logo: '\u{1F7EA}', fee: 6.0 },
  4: { name: 'CSFloat', logo: '\u{1F7E9}', fee: 3.0 },
};

const MOCK_MARKETS = [
  { name: 'Steam', price: 149.99, volume: 142, fee: 13.0, logo: '\u{1F7E6}', market_id: 1 },
  { name: 'Buff163', price: 135.2, volume: 218, fee: 2.5, logo: '\u{1F7E7}', market_id: 2 },
  { name: 'Skinport', price: 139.85, volume: 87, fee: 6.0, logo: '\u{1F7EA}', market_id: 3 },
  { name: 'CSFloat', price: 137.1, volume: 40, fee: 3.0, logo: '\u{1F7E9}', market_id: 4 },
];

function generateMockPriceData(count: number, endPrice: number): number[] {
  const base = 130;
  const points: number[] = [];
  let current = base;
  for (let i = 0; i < count; i++) {
    current += (Math.random() - 0.45) * 6;
    current = Math.max(100, Math.min(165, current));
    points.push(current);
  }
  points[points.length - 1] = endPrice;
  return points;
}

// ── Helper Components ────────────────────────────────────────────────────────

function clsx(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

function LiveIndicator() {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400">Live</span>
    </span>
  );
}

function PriceChart({ data, activeRange, onRangeChange, currentPrice, changePct, isConnected }: {
  data: number[];
  activeRange: string;
  onRangeChange: (r: string) => void;
  currentPrice: number;
  changePct: number;
  isConnected: boolean;
}) {
  const safeData = data.length >= 2 ? data : [100, 100];
  const maxVal = Math.max(...safeData);
  const minVal = Math.min(...safeData);
  const range = maxVal - minVal || 1;

  const pathD = safeData
    .map((val, i) => {
      const x = (i / (safeData.length - 1)) * 100;
      const y = 100 - ((val - minVal) / range) * 80 - 10;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  const areaD = pathD + ' L 100 100 L 0 100 Z';

  // last point coordinates for the pulse dot
  const lastX = 100;
  const lastY = 100 - ((safeData[safeData.length - 1] - minVal) / range) * 80 - 10;

  const ranges = ['1H', '6H', '24H', '7D', '30D'];

  return (
    <div className="glass-panel p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-glow/[0.08]">
            <Activity className="w-4 h-4 text-cyan-glow" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Price History</h2>
            <p className="text-[11px] text-gray-500 font-mono mt-0.5">
              {activeRange} Chart &bull; {safeData.length} data points
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2 justify-end">
            <span className="text-xl font-bold font-mono text-white">${currentPrice.toFixed(2)}</span>
            {isConnected && <LiveIndicator />}
          </div>
          <div className="flex items-center gap-1 justify-end mt-0.5">
            {changePct >= 0
              ? <ArrowUpRight className="w-3 h-3 text-emerald-400" />
              : <ArrowDownRight className="w-3 h-3 text-red-400" />}
            <span className={clsx(
              'text-[11px] font-bold font-mono',
              changePct >= 0 ? 'text-emerald-400' : 'text-red-400'
            )}>
              {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="relative h-56 rounded-xl bg-carbon-900/50 border border-white/[0.03] overflow-hidden p-4">
        {/* Grid */}
        <div className="absolute inset-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="absolute w-full border-t border-white/[0.03]"
              style={{ top: `${i * 25}%` }}
            />
          ))}
        </div>

        {/* Y-axis labels */}
        <div className="absolute left-5 top-4 bottom-4 flex flex-col justify-between">
          {[maxVal, (maxVal + minVal) / 2, minVal].map((v, i) => (
            <span key={i} className="text-[9px] font-mono text-gray-600">${v.toFixed(0)}</span>
          ))}
        </div>

        <svg viewBox="0 0 100 100" className="absolute inset-4 w-[calc(100%-2rem)] h-[calc(100%-2rem)]" preserveAspectRatio="none">
          <defs>
            <linearGradient id="detailChartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(0, 229, 255, 0.2)" />
              <stop offset="100%" stopColor="rgba(0, 229, 255, 0)" />
            </linearGradient>
          </defs>
          <path d={areaD} fill="url(#detailChartGradient)" />
          <path d={pathD} fill="none" stroke="#00e5ff" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          {/* Pulse dot at latest price */}
          <circle cx={lastX} cy={lastY} r="2.5" fill="#00e5ff" stroke="#00e5ff" strokeWidth="1" vectorEffect="non-scaling-stroke">
            <animate attributeName="r" values="2;4;2" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="1;0.5;1" dur="2s" repeatCount="indefinite" />
          </circle>
        </svg>
      </div>

      {/* Time range selector */}
      <div className="flex items-center gap-1 mt-4">
        {ranges.map((r) => (
          <button
            key={r}
            onClick={() => onRangeChange(r)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-[11px] font-bold font-mono transition-all duration-200',
              r === activeRange
                ? 'bg-cyan-glow/10 text-cyan-glow border border-cyan-glow/20'
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]'
            )}
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  );
}

function CircularProgress({ value, size = 96 }: { value: number; size?: number }) {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const color = value >= 80 ? '#00e5ff' : value >= 60 ? '#fbbf24' : value >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{
            filter: `drop-shadow(0 0 6px ${color}60)`,
            transition: 'stroke-dashoffset 1s ease-out',
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold font-mono text-white">{value}</span>
        <span className="text-[9px] text-gray-500 uppercase tracking-wider">Score</span>
      </div>
    </div>
  );
}

function FloatBar({ value, min, max }: { value: number; min: number; max: number }) {
  const pct = ((value - min) / (max - min)) * 100;
  const zones = [
    { label: 'FN', end: 7, color: 'bg-emerald-500' },
    { label: 'MW', end: 15, color: 'bg-green-400' },
    { label: 'FT', end: 38, color: 'bg-yellow-400' },
    { label: 'WW', end: 45, color: 'bg-orange-400' },
    { label: 'BS', end: 100, color: 'bg-red-500' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] text-gray-500 font-mono">{min.toFixed(2)}</span>
        <span className="text-[11px] text-cyan-glow font-mono font-bold">{value.toFixed(4)}</span>
        <span className="text-[10px] text-gray-500 font-mono">{max.toFixed(2)}</span>
      </div>
      <div className="relative h-2.5 rounded-full overflow-hidden flex">
        {zones.map((zone, i) => {
          const prevEnd = i > 0 ? zones[i - 1].end : 0;
          const width = zone.end - prevEnd;
          return (
            <div
              key={zone.label}
              className={clsx(zone.color, 'opacity-30 h-full')}
              style={{ width: `${width}%` }}
            />
          );
        })}
        {/* Float indicator */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-white bg-cyan-glow"
          style={{
            left: `${pct}%`,
            transform: `translate(-50%, -50%)`,
            boxShadow: '0 0 8px rgba(0, 229, 255, 0.6)',
          }}
        />
      </div>
      <div className="flex justify-between mt-1">
        {zones.map((zone) => (
          <span key={zone.label} className="text-[8px] text-gray-600 font-mono font-bold uppercase">{zone.label}</span>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

const SkinDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [activeRange, setActiveRange] = useState('7D');
  const [chartMode, setChartMode] = useState<'candle' | 'line'>('candle');

  // ── Real-time hooks ──
  const isConnected = useConnectionStatus();
  const { prices: livePrices } = useLiveSkinPrices(id);
  const liveFeed = useLivePriceFeed(50);

  // ── Skin details state ──
  const [skin, setSkin] = useState<any>(null);
  const [skinLoading, setSkinLoading] = useState(true);

  // ── Price history state ──
  const [priceHistory, setPriceHistory] = useState<number[]>([]);

  // ── AI Analysis state ──
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);

  // ── Last refresh timestamp ──
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // ── Previous prices for flash animation ──
  const prevPricesRef = useRef<Record<number, number>>({});
  const [flashMarkets, setFlashMarkets] = useState<Set<number>>(new Set());

  // Fetch skin details on mount
  useEffect(() => {
    if (!id) return;
    setSkinLoading(true);
    skinsApi.getById(id)
      .then((res) => {
        if (res.data) {
          setSkin(res.data);
        }
      })
      .catch(() => {
        // Fallback to mock data handled below via `s` variable
      })
      .finally(() => setSkinLoading(false));
  }, [id]);

  // Fetch price history on mount
  useEffect(() => {
    if (!id) return;
    skinsApi.getHistory(id, 30)
      .then((res) => {
        if (res.data && Array.isArray(res.data)) {
          const points = res.data.map((p: any) => typeof p === 'number' ? p : p.price ?? p.close ?? p.value ?? 0);
          if (points.length >= 2) {
            setPriceHistory(points);
          }
        }
      })
      .catch(() => {
        // Fallback to generated mock data
      });
  }, [id]);

  // Fetch AI analysis on mount
  useEffect(() => {
    if (!id) return;
    skinsApi.getAnalysis(id)
      .then((res) => {
        if (res.data) {
          setAiAnalysis(res.data);
        }
      })
      .catch(() => {
        // Keep mock fallback
      });
  }, [id]);

  // Append live price feed data to chart when it matches this skin
  useEffect(() => {
    if (!id || liveFeed.length === 0) return;
    const relevant = liveFeed.filter((f: any) => String(f.skinId) === id);
    if (relevant.length > 0) {
      const latestPrice = relevant[0].newPrice;
      if (typeof latestPrice === 'number' && latestPrice > 0) {
        setPriceHistory((prev) => {
          if (prev.length === 0) return prev;
          const last = prev[prev.length - 1];
          if (last === latestPrice) return prev;
          return [...prev, latestPrice];
        });
        setLastRefresh(new Date());
      }
    }
  }, [liveFeed, id]);

  // Detect price changes for flash animation
  useEffect(() => {
    if (livePrices.length === 0) return;
    const changedMarkets = new Set<number>();
    livePrices.forEach((p: any) => {
      const prevPrice = prevPricesRef.current[p.market_id];
      if (prevPrice !== undefined && prevPrice !== p.price) {
        changedMarkets.add(p.market_id);
      }
      prevPricesRef.current[p.market_id] = p.price;
    });
    if (changedMarkets.size > 0) {
      setFlashMarkets(changedMarkets);
      setLastRefresh(new Date());
      const timer = setTimeout(() => setFlashMarkets(new Set()), 1500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [livePrices]);

  // ── Resolved data (API or fallback) ──
  const s = skin || MOCK_SKIN;
  const weaponName = s.weapon_name || s.weapon || 'Unknown';
  const skinName = s.skin_name || s.skinName || 'Unknown';
  const rarity = s.rarity || 'Covert';
  const rarityColor = s.rarity_color || s.rarityColor || '#eb4b4b';
  const collection = s.collection || 'Unknown Collection';
  const exterior = s.exterior || 'Factory New';
  const floatValue = s.float_value ?? s.floatValue ?? 0.0312;
  const floatMin = s.float_min ?? s.floatMin ?? 0.0;
  const floatMax = s.float_max ?? s.floatMax ?? 0.5;
  const currentPrice = s.current_price ?? s.currentPrice ?? 142.5;
  const changePct = s.change_24h ?? s.changePct24h ?? 0;
  const priceChange = s.price_change_24h ?? s.change24h ?? (currentPrice * changePct / 100);
  const volume24h = s.volume_24h ?? s.volume24h ?? 0;
  const high24h = s.high_24h ?? s.highPrice24h ?? currentPrice;
  const low24h = s.low_24h ?? s.lowPrice24h ?? currentPrice;
  const ath = s.all_time_high ?? s.allTimeHigh ?? currentPrice;
  const atl = s.all_time_low ?? s.allTimeLow ?? currentPrice;

  // ── Market data ──
  const markets = livePrices.length > 0
    ? livePrices.map((p: any) => {
        const info = MARKET_ID_MAP[p.market_id] || { name: `Market ${p.market_id}`, logo: '\u{2B1C}', fee: 5.0 };
        return {
          market_id: p.market_id,
          name: info.name,
          logo: info.logo,
          price: p.price,
          volume: p.volume ?? 0,
          fee: info.fee,
          last_updated: p.last_updated,
        };
      })
    : MOCK_MARKETS;

  const bestMarket = markets.reduce((best, m) => {
    const net = m.price * (1 - m.fee / 100);
    const bestNet = best.price * (1 - best.fee / 100);
    return net < bestNet ? m : best;
  }, markets[0]);

  // ── Chart data ──
  const chartData = priceHistory.length >= 2 ? priceHistory : generateMockPriceData(30, currentPrice);

  // ── AI Analysis (API or fallback) ──
  const analysis = aiAnalysis || MOCK_AI_ANALYSIS;
  const oppScore = analysis.opportunityScore ?? analysis.opportunity_score ?? MOCK_AI_ANALYSIS.opportunityScore;
  const recommendation = analysis.recommendation ?? MOCK_AI_ANALYSIS.recommendation;
  const confidence = analysis.confidence ?? MOCK_AI_ANALYSIS.confidence;
  const predicted7d = analysis.predictedPrice7d ?? analysis.predicted_price_7d ?? MOCK_AI_ANALYSIS.predictedPrice7d;
  const predicted30d = analysis.predictedPrice30d ?? analysis.predicted_price_30d ?? MOCK_AI_ANALYSIS.predictedPrice30d;
  const reasons = analysis.reasons ?? analysis.key_signals ?? MOCK_AI_ANALYSIS.reasons;

  // ── Technicals (API or fallback) ──
  const tech = aiAnalysis?.technicals || aiAnalysis || {};
  const ma7d = tech.ma7d ?? tech.ma_7d ?? MOCK_TECHNICALS.ma7d;
  const ma30d = tech.ma30d ?? tech.ma_30d ?? MOCK_TECHNICALS.ma30d;
  const volatility = tech.volatility ?? MOCK_TECHNICALS.volatility;
  const trendDirection = tech.trendDirection ?? tech.trend_direction ?? MOCK_TECHNICALS.trendDirection;
  const rsi = tech.rsi ?? MOCK_TECHNICALS.rsi;
  const support = tech.support ?? MOCK_TECHNICALS.support;
  const resistance = tech.resistance ?? MOCK_TECHNICALS.resistance;

  // ── Time since last refresh ──
  const [secondsAgo, setSecondsAgo] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastRefresh.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [lastRefresh]);

  // ── Recommendation color ──
  const recColor = recommendation.toLowerCase().includes('buy')
    ? 'text-emerald-400'
    : recommendation.toLowerCase().includes('sell')
    ? 'text-red-400'
    : 'text-yellow-400';

  if (skinLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="glass-panel p-8 text-center space-y-4">
          <div className="w-10 h-10 border-2 border-cyan-glow/30 border-t-cyan-glow rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-400 font-mono">Loading skin data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto fade-in">
      {/* Back nav */}
      <div className="flex items-center gap-3">
        <Link
          to="/"
          className="flex items-center gap-1.5 text-gray-500 hover:text-cyan-glow transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </Link>
        <span className="text-gray-700">/</span>
        <span className="text-[11px] text-gray-500 font-mono">{id || MOCK_SKIN.id}</span>
      </div>

      {/* ═══════════════ HERO SECTION ═══════════════ */}
      <div className="glass-panel p-6 md:p-8">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          {/* Left: Name / Metadata */}
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span
                className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider"
                style={{
                  backgroundColor: `${rarityColor}18`,
                  color: rarityColor,
                  border: `1px solid ${rarityColor}30`,
                }}
              >
                {rarity}
              </span>
              <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">{collection}</span>
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">{weaponName}</h1>
              <p className="text-xl text-gray-400 mt-1">{skinName}</p>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="glass-panel-subtle px-3 py-2 flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-cyan-glow/60" />
                <span className="text-[11px] font-mono text-gray-300">{exterior}</span>
              </div>
              <div className="glass-panel-subtle px-3 py-2 flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-gold-400/60" />
                <span className="text-[11px] font-mono text-gray-300">Float: {floatValue.toFixed(4)}</span>
              </div>
              <div className="glass-panel-subtle px-3 py-2 flex items-center gap-2">
                <BarChart3 className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-[11px] font-mono text-gray-300">{volume24h} sold / 24h</span>
              </div>
            </div>

            {/* Float bar */}
            <div className="max-w-md pt-2">
              <FloatBar value={floatValue} min={floatMin} max={floatMax} />
            </div>
          </div>

          {/* Right: Price */}
          <div className="flex-shrink-0 text-right space-y-3 min-w-[220px]">
            <div>
              <div className="flex items-center justify-end gap-2 mb-1">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Current Price</p>
                {isConnected && <LiveIndicator />}
              </div>
              <h2 className="text-4xl font-bold font-mono text-white tracking-tight">${currentPrice.toFixed(2)}</h2>
            </div>
            <div className="flex items-center justify-end gap-2">
              <div className={clsx(
                'flex items-center gap-1 px-2 py-1 rounded-lg text-[12px] font-bold font-mono',
                changePct >= 0
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-red-500/10 text-red-400'
              )}>
                {changePct >= 0
                  ? <ArrowUpRight className="w-3.5 h-3.5" />
                  : <ArrowDownRight className="w-3.5 h-3.5" />}
                {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
              </div>
              <span className="text-[11px] text-gray-500 font-mono">
                {priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}
              </span>
            </div>

            {/* Quick stats */}
            <div className="space-y-2 pt-2 border-t border-white/[0.04]">
              {[
                { label: '24h High', value: `$${high24h.toFixed(2)}` },
                { label: '24h Low', value: `$${low24h.toFixed(2)}` },
                { label: 'ATH', value: `$${ath.toFixed(2)}` },
                { label: 'ATL', value: `$${atl.toFixed(2)}` },
              ].map((stat) => (
                <div key={stat.label} className="flex items-center justify-between text-[11px]">
                  <span className="text-gray-500">{stat.label}</span>
                  <span className="font-mono text-gray-300">{stat.value}</span>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
              <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-glow/10 border border-cyan-glow/20 text-cyan-glow text-[12px] font-bold hover:bg-cyan-glow/20 transition-all">
                <Star className="w-3.5 h-3.5" />
                Watchlist
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gold-400/10 border border-gold-400/20 text-gold-400 text-[12px] font-bold hover:bg-gold-400/20 transition-all">
                <Bell className="w-3.5 h-3.5" />
                Set Alert
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════ CHART + AI ANALYSIS ═══════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {/* Chart mode toggle */}
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => setChartMode('candle')}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-[11px] font-bold font-mono transition-all duration-200',
                chartMode === 'candle'
                  ? 'bg-cyan-glow/10 text-cyan-glow border border-cyan-glow/20'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]'
              )}
            >
              Candlestick
            </button>
            <button
              onClick={() => setChartMode('line')}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-[11px] font-bold font-mono transition-all duration-200',
                chartMode === 'line'
                  ? 'bg-cyan-glow/10 text-cyan-glow border border-cyan-glow/20'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]'
              )}
            >
              Line
            </button>
          </div>

          {chartMode === 'candle' ? (
            <div className="h-[calc(100vh-400px)] min-h-[450px]">
              <CandlestickChart
                skinId={typeof s.id === 'number' ? s.id : parseInt(id || '1')}
                marketId={1}
                skinName={`${weaponName} | ${skinName}`}
                height={0}
                showIntervalSelector={true}
                showVolume={true}
                className="h-full"
              />
            </div>
          ) : (
            <PriceChart
              data={chartData}
              activeRange={activeRange}
              onRangeChange={setActiveRange}
              currentPrice={currentPrice}
              changePct={changePct}
              isConnected={isConnected}
            />
          )}
        </div>

        {/* AI Analysis */}
        <div className="glass-panel p-6 flex flex-col">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 rounded-lg bg-gold-400/[0.08]">
              <Crosshair className="w-4 h-4 text-gold-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">AI Analysis</h2>
              <p className="text-[11px] text-gray-500 font-mono mt-0.5">ML Model v3.2</p>
            </div>
            <div className="ml-auto neon-dot-gold" />
          </div>

          <div className="flex items-center gap-5 mb-5">
            <CircularProgress value={oppScore} />
            <div className="space-y-2">
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Recommendation</p>
                <p className={clsx('text-lg font-bold', recColor)}>{recommendation}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Confidence</p>
                <div className="flex items-center gap-2">
                  <div className="w-16 bg-carbon-900/80 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-cyan-glow"
                      style={{
                        width: `${confidence}%`,
                        boxShadow: '0 0 6px rgba(0, 229, 255, 0.4)',
                      }}
                    />
                  </div>
                  <span className="text-[11px] font-mono text-gray-300">{confidence}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Price predictions */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="glass-panel-subtle p-3">
              <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">7-Day Target</p>
              <p className="text-lg font-bold font-mono text-white">${predicted7d.toFixed(2)}</p>
              <span className={clsx(
                'text-[10px] font-mono',
                predicted7d >= currentPrice ? 'text-emerald-400' : 'text-red-400'
              )}>
                {predicted7d >= currentPrice ? '+' : ''}{((predicted7d / currentPrice - 1) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="glass-panel-subtle p-3">
              <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">30-Day Target</p>
              <p className="text-lg font-bold font-mono text-white">${predicted30d.toFixed(2)}</p>
              <span className={clsx(
                'text-[10px] font-mono',
                predicted30d >= currentPrice ? 'text-emerald-400' : 'text-red-400'
              )}>
                {predicted30d >= currentPrice ? '+' : ''}{((predicted30d / currentPrice - 1) * 100).toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Reasons */}
          <div className="space-y-2 flex-1">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Key Signals</p>
            {(Array.isArray(reasons) ? reasons : MOCK_AI_ANALYSIS.reasons).map((reason: string, i: number) => (
              <div key={i} className="flex items-start gap-2">
                <div className="neon-dot mt-1.5 flex-shrink-0" style={{ width: 5, height: 5 }} />
                <span className="text-[11px] text-gray-400 leading-relaxed">{reason}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════ MARKET COMPARISON + TECHNICALS ═══════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Market Comparison */}
        <div className="lg:col-span-2 glass-panel p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 rounded-lg bg-cyan-glow/[0.08]">
              <BarChart3 className="w-4 h-4 text-cyan-glow" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Market Comparison</h2>
              <p className="text-[11px] text-gray-500 font-mono mt-0.5">
                {livePrices.length > 0 ? 'Real-time prices across' : 'Prices across'} {markets.length} markets
              </p>
            </div>
            {isConnected && <div className="ml-auto"><LiveIndicator /></div>}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left py-3 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Market</th>
                  <th className="text-right py-3 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Price</th>
                  <th className="text-right py-3 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Volume</th>
                  <th className="text-right py-3 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Fee</th>
                  <th className="text-right py-3 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Net Price</th>
                  <th className="text-right py-3 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {markets.map((market) => {
                  const netPrice = market.price * (1 - market.fee / 100);
                  const isBest = market.name === bestMarket.name;
                  const isFlashing = flashMarkets.has(market.market_id);
                  return (
                    <tr
                      key={market.name}
                      className={clsx(
                        'border-b border-white/[0.03] transition-all duration-500 group cursor-pointer',
                        isBest ? 'bg-cyan-glow/[0.03]' : 'hover:bg-white/[0.02]',
                        isFlashing && 'bg-cyan-glow/[0.08]'
                      )}
                    >
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{market.logo}</span>
                          <span className="text-[13px] text-white font-semibold group-hover:text-cyan-glow/90 transition-colors">
                            {market.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 text-right">
                        <span className={clsx(
                          'font-mono text-[13px] transition-all duration-500',
                          isFlashing ? 'text-cyan-glow scale-110' : 'text-gray-300'
                        )}>
                          ${market.price.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        <span className="font-mono text-[12px] text-gray-500">{market.volume}</span>
                      </td>
                      <td className="py-4 text-right">
                        <span className="font-mono text-[12px] text-gray-500">{market.fee}%</span>
                      </td>
                      <td className="py-4 text-right">
                        <span className={clsx(
                          'font-mono text-[13px] font-bold transition-all duration-500',
                          isBest ? 'text-cyan-glow' : 'text-gray-300',
                          isFlashing && 'text-cyan-glow'
                        )}>
                          ${netPrice.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        {isBest ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-cyan-glow/10 text-cyan-glow border border-cyan-glow/20">
                            <Award className="w-3 h-3" />
                            Best Price
                          </span>
                        ) : (
                          <ExternalLink className="w-3.5 h-3.5 text-gray-600 inline-block" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Technical Indicators */}
        <div className="glass-panel p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 rounded-lg bg-cyan-glow/[0.08]">
              <Target className="w-4 h-4 text-cyan-glow" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Technical Indicators</h2>
              <p className="text-[11px] text-gray-500 font-mono mt-0.5">Key Metrics</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* MA indicators */}
            <div className="glass-panel-subtle p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">7-Day MA</p>
                  <p className="text-base font-bold font-mono text-white mt-0.5">${ma7d.toFixed(2)}</p>
                </div>
                <div className={clsx(
                  'px-1.5 py-0.5 rounded text-[10px] font-bold font-mono',
                  currentPrice < ma7d
                    ? 'bg-red-500/10 text-red-400'
                    : 'bg-emerald-500/10 text-emerald-400'
                )}>
                  {currentPrice < ma7d ? 'Below' : 'Above'}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">30-Day MA</p>
                  <p className="text-base font-bold font-mono text-white mt-0.5">${ma30d.toFixed(2)}</p>
                </div>
                <div className={clsx(
                  'px-1.5 py-0.5 rounded text-[10px] font-bold font-mono',
                  currentPrice < ma30d
                    ? 'bg-red-500/10 text-red-400'
                    : 'bg-emerald-500/10 text-emerald-400'
                )}>
                  {currentPrice < ma30d ? 'Below' : 'Above'}
                </div>
              </div>
            </div>

            {/* Volatility */}
            <div className="glass-panel-subtle p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Volatility (30d)</p>
                  <p className="text-base font-bold font-mono text-white mt-0.5">{volatility}%</p>
                </div>
                <div className={clsx(
                  'px-1.5 py-0.5 rounded text-[10px] font-bold font-mono',
                  volatility > 15
                    ? 'bg-gold-500/10 text-gold-400'
                    : 'bg-emerald-500/10 text-emerald-400'
                )}>
                  {volatility > 15 ? 'High' : 'Moderate'}
                </div>
              </div>
            </div>

            {/* Trend */}
            <div className="glass-panel-subtle p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Trend Direction</p>
                  <div className="flex items-center gap-2 mt-1">
                    {trendDirection === 'up' ? (
                      <TrendingUp className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-red-400" />
                    )}
                    <span className={clsx(
                      'text-base font-bold',
                      trendDirection === 'up' ? 'text-emerald-400' : 'text-red-400'
                    )}>
                      {trendDirection === 'up' ? 'Bullish' : 'Bearish'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* RSI */}
            <div className="glass-panel-subtle p-4">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">RSI (14)</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-carbon-900/80 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${rsi}%`,
                      background: rsi < 30
                        ? 'linear-gradient(90deg, #ef4444, #f87171)'
                        : rsi > 70
                        ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                        : 'linear-gradient(90deg, #00e5ff, #22d3ee)',
                      boxShadow: '0 0 6px rgba(0, 229, 255, 0.3)',
                    }}
                  />
                </div>
                <span className="text-sm font-bold font-mono text-white w-10 text-right">{rsi}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[8px] text-red-400/60 font-mono">Oversold</span>
                <span className="text-[8px] text-gray-600 font-mono">Neutral</span>
                <span className="text-[8px] text-emerald-400/60 font-mono">Overbought</span>
              </div>
            </div>

            {/* Support / Resistance */}
            <div className="glass-panel-subtle p-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Support</p>
                  <p className="text-sm font-bold font-mono text-red-400 mt-0.5">${support.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Resistance</p>
                  <p className="text-sm font-bold font-mono text-emerald-400 mt-0.5">${resistance.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer timestamp */}
      <div className="flex items-center justify-center gap-2 pb-4">
        <Clock className="w-3 h-3 text-gray-600" />
        <span className="text-[10px] text-gray-600 font-mono">
          Data refreshed {secondsAgo} second{secondsAgo !== 1 ? 's' : ''} ago
        </span>
        {isConnected ? (
          <div className="neon-dot" style={{ width: 5, height: 5 }} />
        ) : (
          <div className="w-[5px] h-[5px] rounded-full bg-gray-600" />
        )}
      </div>
    </div>
  );
};

export default SkinDetail;
