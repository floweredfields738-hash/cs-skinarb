import React, { useState, useRef } from 'react';
import { Search, Plus, X, Calculator, AlertCircle } from 'lucide-react';

interface TradeUpSkin {
  id: number;
  name: string;
  rarity: string;
  price: number;
  floatValue: number;
}

// CS2 Trade-Up: 10 skins of same rarity → 1 skin of next rarity
// Output float = average of input floats, scaled to output skin's float range
const RARITY_ORDER = ['Consumer Grade', 'Industrial Grade', 'Mil-Spec', 'Restricted', 'Classified', 'Covert'];

const TradeUp: React.FC = () => {
  const [inputs, setInputs] = useState<TradeUpSkin[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [floatInput, setFloatInput] = useState('0.15');
  const [priceInput, setPriceInput] = useState('');
  const [selectedSkin, setSelectedSkin] = useState<any>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setSearchResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/skins/search?q=${encodeURIComponent(q)}&limit=8`);
        const data = await res.json();
        if (data.success) setSearchResults(data.data || []);
      } catch {}
    }, 300);
  };

  const addSkin = () => {
    if (!selectedSkin || inputs.length >= 10) return;
    const price = priceInput ? parseFloat(priceInput) : parseFloat(selectedSkin.current_price || 0);
    setInputs([...inputs, {
      id: selectedSkin.id,
      name: selectedSkin.name,
      rarity: selectedSkin.rarity || 'Mil-Spec',
      price,
      floatValue: parseFloat(floatInput) || 0.15,
    }]);
    setSelectedSkin(null);
    setSearchQuery('');
    setPriceInput('');
    setFloatInput('0.15');
    setSearchResults([]);
  };

  const removeSkin = (index: number) => {
    setInputs(inputs.filter((_, i) => i !== index));
  };

  // Calculate trade-up result
  const totalCost = inputs.reduce((sum, s) => sum + s.price, 0);
  const avgFloat = inputs.length > 0 ? inputs.reduce((sum, s) => sum + s.floatValue, 0) / inputs.length : 0;
  const inputRarity = inputs.length > 0 ? inputs[0].rarity : null;
  const rarityIndex = inputRarity ? RARITY_ORDER.indexOf(inputRarity) : -1;
  const outputRarity = rarityIndex >= 0 && rarityIndex < RARITY_ORDER.length - 1 ? RARITY_ORDER[rarityIndex + 1] : null;
  const allSameRarity = inputs.length > 0 && inputs.every(s => s.rarity === inputs[0].rarity);

  return (
    <div className="space-y-6 fade-in ">

      {/* Input Slots */}
      <div className="glass-panel p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white">Input Skins ({inputs.length}/10)</h3>
          {inputs.length > 0 && (
            <button onClick={() => setInputs([])} className="text-[11px] text-gray-600 hover:text-red-400 transition-colors">
              Clear all
            </button>
          )}
        </div>

        {/* Skin slots grid */}
        <div className="grid grid-cols-5 gap-2 mb-4">
          {Array.from({ length: 10 }).map((_, i) => {
            const skin = inputs[i];
            return (
              <div
                key={i}
                className={`aspect-square rounded-xl border flex items-center justify-center text-center p-2 transition-all ${
                  skin
                    ? 'bg-carbon-800/60 border-white/[0.08]'
                    : 'bg-carbon-900/40 border-dashed border-white/[0.04]'
                }`}
              >
                {skin ? (
                  <div className="relative w-full h-full">
                    <button
                      onClick={() => removeSkin(i)}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-red-500/20 rounded-full flex items-center justify-center text-red-400 hover:bg-red-500/40 transition-all z-10"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                    <div className="flex flex-col items-center justify-center h-full">
                      <p className="text-[8px] text-gray-400 truncate w-full">{skin.name.split(' | ')[1] || skin.name}</p>
                      <p className="text-[9px] text-white font-mono font-bold mt-0.5">${skin.price.toFixed(2)}</p>
                      <p className="text-[7px] text-gray-600 font-mono">{skin.floatValue.toFixed(4)}</p>
                    </div>
                  </div>
                ) : (
                  <span className="text-[10px] text-gray-700">{i + 1}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Validation warnings */}
        {inputs.length > 0 && !allSameRarity && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-[11px] text-red-400">All skins must be the same rarity for a trade-up contract.</p>
          </div>
        )}

        {/* Add skin */}
        {inputs.length < 10 && (
          <div>
            {!selectedSkin ? (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text" value={searchQuery} onChange={e => handleSearch(e.target.value)}
                  placeholder="Search for a skin to add..."
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-carbon-800/80 border border-white/[0.06] text-white text-sm focus:outline-none focus:border-cyan-glow/30"
                />
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 glass-panel max-h-48 overflow-y-auto z-20">
                    {searchResults.map((s: any) => (
                      <button key={s.id} onClick={() => { setSelectedSkin(s); setSearchResults([]); setSearchQuery(s.name); setPriceInput(s.current_price ? parseFloat(s.current_price).toFixed(2) : ''); }}
                        className="w-full text-left px-4 py-2 hover:bg-white/[0.04] transition-all flex justify-between text-sm">
                        <span className="text-white truncate">{s.name}</span>
                        <span className="text-gray-500 font-mono text-xs ml-2">{s.rarity}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <p className="text-[10px] text-gray-500 font-mono mb-1">{selectedSkin.name}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" step="0.01" value={priceInput} onChange={e => setPriceInput(e.target.value)}
                      placeholder="Price ($)" className="px-3 py-2 rounded-lg bg-carbon-800/80 border border-white/[0.06] text-white text-sm font-mono focus:outline-none focus:border-cyan-glow/30" />
                    <input type="number" step="0.0001" value={floatInput} onChange={e => setFloatInput(e.target.value)}
                      placeholder="Float" className="px-3 py-2 rounded-lg bg-carbon-800/80 border border-white/[0.06] text-white text-sm font-mono focus:outline-none focus:border-cyan-glow/30" />
                  </div>
                </div>
                <button onClick={addSkin} className="px-4 py-2 rounded-lg bg-cyan-glow/10 text-cyan-glow border border-cyan-glow/20 hover:bg-cyan-glow/20 transition-all">
                  <Plus className="w-4 h-4" />
                </button>
                <button onClick={() => { setSelectedSkin(null); setSearchQuery(''); }} className="px-4 py-2 rounded-lg text-gray-500 hover:text-red-400 transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Result */}
      {inputs.length > 0 && (
        <div className="glass-panel p-6">
          <div className="flex items-center gap-3 mb-4">
            <Calculator className="w-5 h-5 text-cyan-glow" />
            <h3 className="text-sm font-bold text-white">Trade-Up Analysis</h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-carbon-800/50 rounded-xl p-3">
              <p className="text-[9px] text-gray-500 uppercase tracking-widest font-mono mb-1">Total Cost</p>
              <p className="text-lg font-bold text-red-400 font-mono">${totalCost.toFixed(2)}</p>
            </div>
            <div className="bg-carbon-800/50 rounded-xl p-3">
              <p className="text-[9px] text-gray-500 uppercase tracking-widest font-mono mb-1">Avg Float</p>
              <p className="text-lg font-bold text-white font-mono">{avgFloat.toFixed(6)}</p>
            </div>
            <div className="bg-carbon-800/50 rounded-xl p-3">
              <p className="text-[9px] text-gray-500 uppercase tracking-widest font-mono mb-1">Input Rarity</p>
              <p className="text-sm font-bold text-blue-400">{inputRarity || '—'}</p>
            </div>
            <div className="bg-carbon-800/50 rounded-xl p-3">
              <p className="text-[9px] text-gray-500 uppercase tracking-widest font-mono mb-1">Output Rarity</p>
              <p className="text-sm font-bold text-purple-400">{outputRarity || '—'}</p>
            </div>
          </div>

          {inputs.length === 10 && allSameRarity ? (
            <div className="bg-carbon-800/50 rounded-xl p-4 border-l-2 border-cyan-glow/20">
              <p className="text-sm text-gray-300">
                <span className="text-cyan-glow font-bold">Ready to trade up!</span> You'll receive 1x {outputRarity} skin with an estimated float of ~{avgFloat.toFixed(6)}.
                To be profitable, the output skin needs to be worth more than <span className="text-white font-bold">${totalCost.toFixed(2)}</span>.
              </p>
            </div>
          ) : inputs.length < 10 ? (
            <div className="bg-carbon-800/50 rounded-xl p-4 border-l-2 border-yellow-500/20">
              <p className="text-sm text-yellow-400">Add {10 - inputs.length} more skin{10 - inputs.length > 1 ? 's' : ''} to complete the trade-up contract.</p>
            </div>
          ) : null}
        </div>
      )}

      {/* How it works */}
      <div className="glass-panel p-6">
        <h3 className="text-sm font-bold text-white mb-3">How Trade-Up Contracts Work</h3>
        <div className="space-y-3 text-[12px] text-gray-400">
          <p>1. Submit <span className="text-white font-medium">10 skins of the same rarity</span> (e.g. 10x Mil-Spec)</p>
          <p>2. Receive <span className="text-white font-medium">1 skin of the next higher rarity</span> (e.g. 1x Restricted)</p>
          <p>3. The output skin's <span className="text-white font-medium">float value</span> is based on the average float of your inputs</p>
          <p>4. The specific skin you receive is <span className="text-white font-medium">random</span> from the same collection(s) as your inputs</p>
          <p className="text-cyan-glow/70 mt-2">Tip: Use cheap skins with low floats for the best chance at a valuable output.</p>
        </div>
      </div>
    </div>
  );
};

export default TradeUp;
