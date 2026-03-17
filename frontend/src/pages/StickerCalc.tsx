import React, { useState } from 'react';
import { Sticker, Plus, X, Calculator, DollarSign } from 'lucide-react';

// Sticker premium rules:
// - Applied stickers add ~3-10% of sticker value to skin price
// - 4x same sticker = higher multiplier (up to 15-20%)
// - Position matters: best position = above handle
// - Scraped stickers = much less value
// - Tournament stickers (especially Katowice 2014) can add huge premiums
const STICKER_WEAR_MULTIPLIER: Record<string, number> = {
  '100%': 1.0,    // Perfect
  '80%+': 0.7,
  '50-80%': 0.4,
  'Below 50%': 0.15,
};

const COMBO_MULTIPLIER: Record<number, number> = {
  1: 0.05,   // 1 sticker = ~5% of sticker value added
  2: 0.07,   // 2 stickers = ~7%
  3: 0.08,   // 3 stickers = ~8%
  4: 0.12,   // 4x matching = ~12%
};

interface StickerEntry {
  name: string;
  value: number;
  wear: string;
}

const StickerCalc: React.FC = () => {
  const [skinPrice, setSkinPrice] = useState('');
  const [stickers, setStickers] = useState<StickerEntry[]>([]);
  const [newName, setNewName] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newWear, setNewWear] = useState('100%');

  const addSticker = () => {
    if (!newName || !newValue || stickers.length >= 5) return;
    setStickers([...stickers, { name: newName, value: parseFloat(newValue), wear: newWear }]);
    setNewName('');
    setNewValue('');
  };

  const removeSticker = (i: number) => setStickers(stickers.filter((_, idx) => idx !== i));

  // Calculate premium
  const basePrice = parseFloat(skinPrice) || 0;
  const totalStickerValue = stickers.reduce((sum, s) => sum + s.value, 0);

  // Check if all stickers match (4x craft)
  const allMatch = stickers.length === 4 && stickers.every(s => s.name === stickers[0].name);
  const comboMultiplier = allMatch ? 0.15 : (COMBO_MULTIPLIER[stickers.length] || 0.05);

  // Calculate per-sticker contribution
  const stickerContributions = stickers.map(s => {
    const wearMult = STICKER_WEAR_MULTIPLIER[s.wear] || 1.0;
    return s.value * comboMultiplier * wearMult;
  });
  const totalPremium = stickerContributions.reduce((sum, c) => sum + c, 0);
  const estimatedPrice = basePrice + totalPremium;
  const premiumPercent = basePrice > 0 ? (totalPremium / basePrice) * 100 : 0;

  return (
    <div className="space-y-6 fade-in ">

      {/* Skin Base Price */}
      <div className="glass-panel p-6">
        <label className="block text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-2">Skin Base Price (without sticker premium)</label>
        <div className="relative">
          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="number" step="0.01" value={skinPrice} onChange={e => setSkinPrice(e.target.value)}
            placeholder="0.00"
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-carbon-800/80 border border-white/[0.06] text-white text-lg font-mono focus:outline-none focus:border-cyan-glow/30"
          />
        </div>
      </div>

      {/* Stickers */}
      <div className="glass-panel p-6">
        <h3 className="text-sm font-bold text-white mb-4">Applied Stickers ({stickers.length}/4)</h3>

        {/* Sticker list */}
        {stickers.length > 0 && (
          <div className="space-y-2 mb-4">
            {stickers.map((s, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3 rounded-xl bg-carbon-800/50 border border-white/[0.04]">
                <div className="flex items-center gap-3">
                  <Sticker className="w-4 h-4 text-cyan-glow/50" />
                  <div>
                    <p className="text-sm text-white">{s.name}</p>
                    <p className="text-[10px] text-gray-500 font-mono">
                      ${s.value.toFixed(2)} · {s.wear} condition · adds ~${stickerContributions[i]?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                </div>
                <button onClick={() => removeSticker(i)} className="text-gray-600 hover:text-red-400 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add sticker */}
        {stickers.length < 4 && (
          <div className="grid grid-cols-12 gap-2">
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="Sticker name" className="col-span-4 px-3 py-2.5 rounded-xl bg-carbon-800/80 border border-white/[0.06] text-white text-sm focus:outline-none focus:border-cyan-glow/30" />
            <div className="col-span-3 relative">
              <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-600" />
              <input type="number" step="0.01" value={newValue} onChange={e => setNewValue(e.target.value)}
                placeholder="Value" className="w-full pl-6 pr-2 py-2.5 rounded-xl bg-carbon-800/80 border border-white/[0.06] text-white text-sm font-mono focus:outline-none focus:border-cyan-glow/30" />
            </div>
            <select value={newWear} onChange={e => setNewWear(e.target.value)}
              className="col-span-3 px-2 py-2.5 rounded-xl bg-carbon-800/80 border border-white/[0.06] text-white text-sm focus:outline-none">
              <option value="100%">100%</option>
              <option value="80%+">80%+</option>
              <option value="50-80%">50-80%</option>
              <option value="Below 50%">Below 50%</option>
            </select>
            <button onClick={addSticker} disabled={!newName || !newValue}
              className="col-span-2 flex items-center justify-center rounded-xl bg-cyan-glow/10 text-cyan-glow border border-cyan-glow/20 hover:bg-cyan-glow/20 transition-all disabled:opacity-30">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Result */}
      {basePrice > 0 && stickers.length > 0 && (
        <div className="glass-panel p-6">
          <div className="flex items-center gap-3 mb-4">
            <Calculator className="w-5 h-5 text-cyan-glow" />
            <h3 className="text-sm font-bold text-white">Estimated Value</h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-carbon-800/50 rounded-xl p-3">
              <p className="text-[9px] text-gray-500 uppercase tracking-widest font-mono mb-1">Base Price</p>
              <p className="text-lg font-bold text-white font-mono">${basePrice.toFixed(2)}</p>
            </div>
            <div className="bg-carbon-800/50 rounded-xl p-3">
              <p className="text-[9px] text-gray-500 uppercase tracking-widest font-mono mb-1">Sticker Value</p>
              <p className="text-lg font-bold text-gray-400 font-mono">${totalStickerValue.toFixed(2)}</p>
            </div>
            <div className="bg-carbon-800/50 rounded-xl p-3">
              <p className="text-[9px] text-gray-500 uppercase tracking-widest font-mono mb-1">Premium Added</p>
              <p className="text-lg font-bold text-emerald-400 font-mono">+${totalPremium.toFixed(2)}</p>
              <p className="text-[9px] text-emerald-400/60 font-mono">+{premiumPercent.toFixed(1)}%</p>
            </div>
            <div className="bg-carbon-800/50 rounded-xl p-3">
              <p className="text-[9px] text-gray-500 uppercase tracking-widest font-mono mb-1">Estimated Total</p>
              <p className="text-lg font-bold text-cyan-glow font-mono">${estimatedPrice.toFixed(2)}</p>
            </div>
          </div>

          {allMatch && (
            <div className="bg-emerald-500/10 rounded-xl p-3 border border-emerald-500/20">
              <p className="text-sm text-emerald-400">
                ✨ <span className="font-bold">4x matching craft detected!</span> This commands a higher premium ({(comboMultiplier * 100).toFixed(0)}% of sticker value vs normal {(COMBO_MULTIPLIER[1] * 100).toFixed(0)}%).
              </p>
            </div>
          )}

          <div className="mt-4 bg-carbon-800/50 rounded-xl p-3 border-l-2 border-cyan-glow/20">
            <p className="text-[11px] text-gray-400">
              Note: Sticker premiums are estimates based on market conventions. Actual premiums vary by skin popularity, sticker rarity, and buyer demand. Tournament stickers (especially Katowice 2014) can command significantly higher premiums.
            </p>
          </div>
        </div>
      )}

      {/* Guide */}
      <div className="glass-panel p-6">
        <h3 className="text-sm font-bold text-white mb-3">Sticker Premium Guide</h3>
        <div className="space-y-2 text-[12px] text-gray-400">
          <p>• <span className="text-white">1 sticker</span> adds ~5% of sticker value to skin price</p>
          <p>• <span className="text-white">4x matching stickers</span> adds ~12-15% of total sticker value</p>
          <p>• <span className="text-white">Scraped stickers</span> (below 50%) add very little value (15% of premium)</p>
          <p>• <span className="text-white">Position matters</span> — best position is above handle for most skins</p>
          <p>• <span className="text-white">Katowice 2014 holos</span> can add 20-40% of sticker value</p>
          <p>• <span className="text-white">Cheap skins with expensive stickers</span> = higher premium %</p>
        </div>
      </div>
    </div>
  );
};

export default StickerCalc;
