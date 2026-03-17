import React, { useState } from 'react';
import { Search, Crosshair, AlertCircle, Copy, Check } from 'lucide-react';

const EXTERIOR_RANGES = [
  { name: 'Factory New', abbr: 'FN', min: 0, max: 0.07, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  { name: 'Minimal Wear', abbr: 'MW', min: 0.07, max: 0.15, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  { name: 'Field-Tested', abbr: 'FT', min: 0.15, max: 0.38, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  { name: 'Well-Worn', abbr: 'WW', min: 0.38, max: 0.45, color: 'text-orange-400', bg: 'bg-orange-500/10' },
  { name: 'Battle-Scarred', abbr: 'BS', min: 0.45, max: 1.0, color: 'text-red-400', bg: 'bg-red-500/10' },
];

function getExterior(float: number) {
  return EXTERIOR_RANGES.find(e => float >= e.min && float < e.max) || EXTERIOR_RANGES[4];
}

function getFloatPercentile(float: number, ext: typeof EXTERIOR_RANGES[0]) {
  // How good is this float within its exterior range? 0% = worst, 100% = best
  const range = ext.max - ext.min;
  return Math.round(((ext.max - float) / range) * 100);
}

const FloatChecker: React.FC = () => {
  const [inspectLink, setInspectLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Manual float input for when inspect link API isn't available
  const [manualFloat, setManualFloat] = useState('');
  const [manualName, setManualName] = useState('');
  const [mode, setMode] = useState<'inspect' | 'manual'>('manual');

  const checkFloat = async () => {
    if (mode === 'manual') {
      const float = parseFloat(manualFloat);
      if (isNaN(float) || float < 0 || float > 1) {
        setError('Float must be between 0 and 1');
        return;
      }
      const ext = getExterior(float);
      const percentile = getFloatPercentile(float, ext);
      setResult({
        floatValue: float,
        exterior: ext.name,
        exteriorAbbr: ext.abbr,
        exteriorColor: ext.color,
        exteriorBg: ext.bg,
        percentile,
        skinName: manualName || 'Unknown Skin',
        rarity: percentile >= 90 ? 'Top 10% — premium float' :
                percentile >= 70 ? 'Top 30% — above average' :
                percentile >= 40 ? 'Average float' :
                'Below average float',
      });
      setError('');
      return;
    }

    // Inspect link mode — would need CSFloat API or Steam inspect server
    if (!inspectLink.includes('steam://rungame')) {
      setError('Invalid inspect link. Copy it from the Steam inventory or market listing.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/skins/float-check?url=${encodeURIComponent(inspectLink)}`);
      const data = await res.json();
      if (data.success) {
        const float = data.floatValue;
        const ext = getExterior(float);
        setResult({
          ...data,
          exterior: ext.name,
          exteriorAbbr: ext.abbr,
          exteriorColor: ext.color,
          exteriorBg: ext.bg,
          percentile: getFloatPercentile(float, ext),
        });
      } else {
        setError(data.error || 'Failed to check float. Try manual mode.');
      }
    } catch {
      setError('Failed to connect. Try manual mode instead.');
    } finally {
      setLoading(false);
    }
  };

  const copyFloat = () => {
    if (result?.floatValue) {
      navigator.clipboard.writeText(result.floatValue.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6 fade-in ">

      {/* Mode Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => { setMode('manual'); setResult(null); setError(''); }}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            mode === 'manual' ? 'bg-cyan-glow/10 text-cyan-glow border border-cyan-glow/20' : 'text-gray-500 border border-transparent'
          }`}
        >
          Manual Float
        </button>
        <button
          onClick={() => { setMode('inspect'); setResult(null); setError(''); }}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            mode === 'inspect' ? 'bg-cyan-glow/10 text-cyan-glow border border-cyan-glow/20' : 'text-gray-500 border border-transparent'
          }`}
        >
          Inspect Link
        </button>
      </div>

      {/* Input */}
      <div className="glass-panel p-6">
        {mode === 'manual' ? (
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-2">Skin Name (optional)</label>
              <input
                type="text" value={manualName} onChange={e => setManualName(e.target.value)}
                placeholder="e.g. AK-47 | Redline"
                className="w-full px-4 py-3 rounded-xl bg-carbon-800/80 border border-white/[0.06] text-white text-sm focus:outline-none focus:border-cyan-glow/30"
              />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-2">Float Value</label>
              <div className="flex gap-3">
                <input
                  type="text" value={manualFloat} onChange={e => setManualFloat(e.target.value)}
                  placeholder="0.0312"
                  className="flex-1 px-4 py-3 rounded-xl bg-carbon-800/80 border border-white/[0.06] text-white text-lg font-mono focus:outline-none focus:border-cyan-glow/30"
                  onKeyDown={e => e.key === 'Enter' && checkFloat()}
                />
                <button onClick={checkFloat} disabled={!manualFloat}
                  className="px-6 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-600 to-cyan-glow text-carbon-950 hover:shadow-glow-cyan transition-all disabled:opacity-40">
                  <Crosshair className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-2">Steam Inspect Link</label>
            <div className="flex gap-3">
              <input
                type="text" value={inspectLink} onChange={e => setInspectLink(e.target.value)}
                placeholder="steam://rungame/730/..."
                className="flex-1 px-4 py-3 rounded-xl bg-carbon-800/80 border border-white/[0.06] text-white text-sm font-mono focus:outline-none focus:border-cyan-glow/30"
                onKeyDown={e => e.key === 'Enter' && checkFloat()}
              />
              <button onClick={checkFloat} disabled={loading || !inspectLink}
                className="px-6 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-600 to-cyan-glow text-carbon-950 hover:shadow-glow-cyan transition-all disabled:opacity-40">
                {loading ? '...' : <Search className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-[10px] text-gray-600 mt-2">Right-click a skin in your inventory → "Copy Inspect Link"</p>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="glass-panel p-4 border-l-2 border-red-500/30 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="glass-panel p-6 space-y-6">
          {/* Float Display */}
          <div className="text-center">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-2">Float Value</p>
            <div className="flex items-center justify-center gap-3">
              <p className="text-4xl font-bold text-white font-mono">{result.floatValue.toFixed(14)}</p>
              <button onClick={copyFloat} className="text-gray-500 hover:text-cyan-glow transition-colors">
                {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
            {result.skinName && <p className="text-gray-400 text-sm mt-2">{result.skinName}</p>}
          </div>

          {/* Exterior Badge */}
          <div className="flex justify-center">
            <span className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl text-lg font-bold ${result.exteriorColor} ${result.exteriorBg} border border-white/[0.06]`}>
              {result.exteriorAbbr} — {result.exterior}
            </span>
          </div>

          {/* Float Bar */}
          <div>
            <div className="flex justify-between text-[9px] text-gray-600 font-mono mb-1">
              <span>0.00</span>
              <span>0.07</span>
              <span>0.15</span>
              <span>0.38</span>
              <span>0.45</span>
              <span>1.00</span>
            </div>
            <div className="relative h-4 rounded-full overflow-hidden flex">
              <div className="bg-cyan-500/40 h-full" style={{ width: '7%' }}></div>
              <div className="bg-emerald-500/40 h-full" style={{ width: '8%' }}></div>
              <div className="bg-yellow-500/40 h-full" style={{ width: '23%' }}></div>
              <div className="bg-orange-500/40 h-full" style={{ width: '7%' }}></div>
              <div className="bg-red-500/40 h-full" style={{ width: '55%' }}></div>
              {/* Marker */}
              <div
                className="absolute top-0 w-0.5 h-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]"
                style={{ left: `${result.floatValue * 100}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-[8px] font-mono mt-1">
              <span className="text-cyan-400">FN</span>
              <span className="text-emerald-400">MW</span>
              <span className="text-yellow-400">FT</span>
              <span className="text-orange-400">WW</span>
              <span className="text-red-400">BS</span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-carbon-800/50 rounded-xl p-4">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-1">Percentile in {result.exteriorAbbr}</p>
              <p className="text-2xl font-bold text-cyan-glow">Top {100 - result.percentile}%</p>
              <p className="text-[10px] text-gray-600 mt-1">{result.rarity}</p>
            </div>
            <div className="bg-carbon-800/50 rounded-xl p-4">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-1">Wear Rating</p>
              <p className="text-2xl font-bold text-white">{result.percentile}/100</p>
              <p className="text-[10px] text-gray-600 mt-1">{result.percentile >= 70 ? 'Low wear — more valuable' : result.percentile >= 40 ? 'Average wear' : 'High wear'}</p>
            </div>
          </div>

          {/* Price Impact Info */}
          <div className="bg-carbon-800/50 rounded-xl p-4 border-l-2 border-cyan-glow/20">
            <p className="text-sm text-gray-300">
              {result.percentile >= 90
                ? '💎 This is an exceptional float. Skins with floats this low can command 50-200% premium over average.'
                : result.percentile >= 70
                ? '✨ Above-average float. Expect a 10-30% premium over market average for this exterior.'
                : result.percentile >= 40
                ? '📊 Average float for this exterior. Priced at standard market rates.'
                : '⚠️ Below-average float. May sell for slightly less than market average.'}
            </p>
          </div>
        </div>
      )}

      {/* Float Guide */}
      <div className="glass-panel p-6">
        <h3 className="text-sm font-bold text-white mb-3">Float Value Guide</h3>
        <div className="space-y-2">
          {EXTERIOR_RANGES.map(ext => (
            <div key={ext.abbr} className="flex items-center justify-between py-2 border-b border-white/[0.03] last:border-0">
              <div className="flex items-center gap-3">
                <span className={`text-xs font-bold w-6 ${ext.color}`}>{ext.abbr}</span>
                <span className="text-sm text-gray-300">{ext.name}</span>
              </div>
              <span className="text-xs text-gray-500 font-mono">{ext.min.toFixed(2)} – {ext.max.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FloatChecker;
