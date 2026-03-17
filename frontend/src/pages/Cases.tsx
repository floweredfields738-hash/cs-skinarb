import React, { useState, useEffect, useMemo } from 'react';
import { Package, TrendingUp, TrendingDown, ChevronDown, ChevronUp, BarChart3 } from 'lucide-react';

// ─── CS2 Case Data with drop rates ──────────────────
// Drop rates: Blue 79.92%, Purple 15.98%, Pink 3.2%, Red 0.64%, Gold (knife/glove) 0.26%
const DROP_RATES = {
  'Consumer Grade': 0,
  'Industrial Grade': 0,
  'Mil-Spec': 0.7992,
  'Restricted': 0.1598,
  'Classified': 0.032,
  'Covert': 0.0064,
  'Extraordinary': 0.0026,
};

interface CaseSkin {
  name: string;
  rarity: string;
}

interface CaseData {
  name: string;
  image: string;
  cost: number; // USD cost to open (key + case)
  skins: CaseSkin[];
}

const CS2_CASES: CaseData[] = [
  {
    name: 'Kilowatt Case',
    image: '',
    cost: 2.70,
    skins: [
      { name: 'AK-47 | Inheritance', rarity: 'Covert' },
      { name: 'USP-S | Ticket to Hell', rarity: 'Covert' },
      { name: 'Zeus x27 | Olympus', rarity: 'Classified' },
      { name: 'M4A1-S | Black Lotus', rarity: 'Classified' },
      { name: 'Five-SeveN | Hybrid', rarity: 'Classified' },
      { name: 'Glock-18 | Block-18', rarity: 'Restricted' },
      { name: 'SSG 08 | Dezastre', rarity: 'Restricted' },
      { name: 'Tec-9 | Slag', rarity: 'Restricted' },
      { name: 'MAC-10 | Light Box', rarity: 'Restricted' },
      { name: 'Nova | Dark Sigil', rarity: 'Restricted' },
      { name: 'M249 | Downtown', rarity: 'Mil-Spec' },
      { name: 'Sawed-Off | Analog Input', rarity: 'Mil-Spec' },
      { name: 'MP5-SD | Liquidation', rarity: 'Mil-Spec' },
      { name: 'XM1014 | Iridescent', rarity: 'Mil-Spec' },
      { name: 'MP7 | Just Smile', rarity: 'Mil-Spec' },
      { name: 'FAMAS | Water Elemental', rarity: 'Mil-Spec' },
      { name: 'P2000 | Wicked Sick', rarity: 'Mil-Spec' },
    ],
  },
  {
    name: 'Gallery Case',
    image: '',
    cost: 2.65,
    skins: [
      { name: 'AK-47 | Leet Museo', rarity: 'Covert' },
      { name: 'Glock-18 | Umbral Rabbit', rarity: 'Covert' },
      { name: 'M4A1-S | Emphorosaur-S', rarity: 'Classified' },
      { name: 'Desert Eagle | Ocean Drive', rarity: 'Classified' },
      { name: 'AWP | Duality', rarity: 'Classified' },
      { name: 'Dual Berettas | Flora Carnivora', rarity: 'Restricted' },
      { name: 'FAMAS | Rapid Eye Movement', rarity: 'Restricted' },
      { name: 'MP9 | Starlight Protector', rarity: 'Restricted' },
      { name: 'UMP-45 | Motorized', rarity: 'Restricted' },
      { name: 'Five-SeveN | Berries And Cherries', rarity: 'Restricted' },
      { name: 'Galil AR | Connexion', rarity: 'Mil-Spec' },
      { name: 'P250 | Verdigris', rarity: 'Mil-Spec' },
      { name: 'MAG-7 | Cinquedea', rarity: 'Mil-Spec' },
      { name: 'PP-Bizon | Embargo', rarity: 'Mil-Spec' },
      { name: 'CZ75-Auto | Eco', rarity: 'Mil-Spec' },
      { name: 'Negev | Drop Me', rarity: 'Mil-Spec' },
      { name: 'R8 Revolver | Banana Cannon', rarity: 'Mil-Spec' },
    ],
  },
  {
    name: 'Revolution Case',
    image: '',
    cost: 2.55,
    skins: [
      { name: 'M4A4 | Temukau', rarity: 'Covert' },
      { name: 'AK-47 | Head Shot', rarity: 'Covert' },
      { name: 'AWP | Chromatic Aberration', rarity: 'Classified' },
      { name: 'P2000 | Lifted Spirits', rarity: 'Classified' },
      { name: 'Galil AR | Chromatic Aberration', rarity: 'Classified' },
      { name: 'MAC-10 | Sling', rarity: 'Restricted' },
      { name: 'P250 | Re.built', rarity: 'Restricted' },
      { name: 'SG 553 | Cyberforce', rarity: 'Restricted' },
      { name: 'Tec-9 | Rebel', rarity: 'Restricted' },
      { name: 'UMP-45 | Wild Child', rarity: 'Restricted' },
      { name: 'MAG-7 | Bulldozer', rarity: 'Mil-Spec' },
      { name: 'MP9 | Featherweight', rarity: 'Mil-Spec' },
      { name: 'MP5-SD | Liquidation', rarity: 'Mil-Spec' },
      { name: 'Negev | Ultralight', rarity: 'Mil-Spec' },
      { name: 'SCAR-20 | Enforcer', rarity: 'Mil-Spec' },
      { name: 'M249 | Deep Relief', rarity: 'Mil-Spec' },
      { name: 'XM1014 | Entombed', rarity: 'Mil-Spec' },
    ],
  },
  {
    name: 'Recoil Case',
    image: '',
    cost: 2.50,
    skins: [
      { name: 'AK-47 | Ice Coaled', rarity: 'Covert' },
      { name: 'USP-S | Printstream', rarity: 'Covert' },
      { name: 'M4A1-S | Welcome to the Jungle', rarity: 'Classified' },
      { name: 'Glock-18 | Sacrifice', rarity: 'Classified' },
      { name: 'SG 553 | Integrale', rarity: 'Classified' },
      { name: 'P90 | Freight', rarity: 'Restricted' },
      { name: 'Dual Berettas | Dezastre', rarity: 'Restricted' },
      { name: 'R8 Revolver | Crazy 8', rarity: 'Restricted' },
      { name: 'Sawed-Off | Kiss♥Love', rarity: 'Restricted' },
      { name: 'Nova | Clear Polymer', rarity: 'Restricted' },
      { name: 'MP7 | Cyan Blossom', rarity: 'Mil-Spec' },
      { name: 'PP-Bizon | Space Cat', rarity: 'Mil-Spec' },
      { name: 'FAMAS | Meow 36', rarity: 'Mil-Spec' },
      { name: 'P250 | Visions', rarity: 'Mil-Spec' },
      { name: 'G3SG1 | Digital Mesh', rarity: 'Mil-Spec' },
      { name: 'M249 | Warbird', rarity: 'Mil-Spec' },
      { name: 'UMP-45 | Oscillator', rarity: 'Mil-Spec' },
    ],
  },
  {
    name: 'Dreams & Nightmares Case',
    image: '',
    cost: 2.50,
    skins: [
      { name: 'AK-47 | Nightwish', rarity: 'Covert' },
      { name: 'MP9 | Starlight Protector', rarity: 'Covert' },
      { name: 'FAMAS | Rapid Eye Movement', rarity: 'Classified' },
      { name: 'USP-S | Ticket to Hell', rarity: 'Classified' },
      { name: 'M4A1-S | Night Terror', rarity: 'Classified' },
      { name: 'XM1014 | Zombie Offensive', rarity: 'Restricted' },
      { name: 'MAG-7 | Foresight', rarity: 'Restricted' },
      { name: 'PP-Bizon | Space Cat', rarity: 'Restricted' },
      { name: 'Five-SeveN | Scrawl', rarity: 'Restricted' },
      { name: 'MP5-SD | Kitbash', rarity: 'Restricted' },
      { name: 'G3SG1 | Dream Glade', rarity: 'Mil-Spec' },
      { name: 'P2000 | Space Race', rarity: 'Mil-Spec' },
      { name: 'Dual Berettas | Hideout', rarity: 'Mil-Spec' },
      { name: 'SCAR-20 | Poultrygeist', rarity: 'Mil-Spec' },
      { name: 'Sawed-Off | Apocalypto', rarity: 'Mil-Spec' },
      { name: 'MAC-10 | Ensnared', rarity: 'Mil-Spec' },
      { name: 'Nova | Windblown', rarity: 'Mil-Spec' },
    ],
  },
  {
    name: 'Snakebite Case',
    image: '',
    cost: 2.55,
    skins: [
      { name: 'M4A1-S | Printstream', rarity: 'Covert' },
      { name: 'USP-S | The Traitor', rarity: 'Covert' },
      { name: 'Desert Eagle | Trigger Discipline', rarity: 'Classified' },
      { name: 'Galil AR | Chromatic Aberration', rarity: 'Classified' },
      { name: 'XM1014 | XOXO', rarity: 'Classified' },
      { name: 'Negev | dev_texture', rarity: 'Restricted' },
      { name: 'MAC-10 | Button Masher', rarity: 'Restricted' },
      { name: 'CZ75-Auto | Circaetus', rarity: 'Restricted' },
      { name: 'MP9 | Food Chain', rarity: 'Restricted' },
      { name: 'R8 Revolver | Crazy 8', rarity: 'Restricted' },
      { name: 'P90 | Cocoa Rampage', rarity: 'Mil-Spec' },
      { name: 'SSG 08 | Parallax', rarity: 'Mil-Spec' },
      { name: 'Sawed-Off | Spirit Board', rarity: 'Mil-Spec' },
      { name: 'Glock-18 | Clear Polymer', rarity: 'Mil-Spec' },
      { name: 'P250 | Cyber Shell', rarity: 'Mil-Spec' },
      { name: 'M249 | O.S.I.P.R.', rarity: 'Mil-Spec' },
      { name: 'Nova | Mandrel', rarity: 'Mil-Spec' },
    ],
  },
];

// Average knife/glove value for EV calculation
const AVG_KNIFE_VALUE = 350;

const Cases: React.FC = () => {
  const [prices, setPrices] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [expandedCase, setExpandedCase] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'ev' | 'roi' | 'name' | 'cost'>('roi');

  // Fetch real prices for all case skins
  useEffect(() => {
    async function fetchPrices() {
      try {
        const allSkinNames = CS2_CASES.flatMap(c => c.skins.map(s => s.name));
        const uniqueNames = [...new Set(allSkinNames)];
        const priceMap = new Map<string, number>();

        // Batch fetch — search for each skin
        for (const name of uniqueNames) {
          try {
            const baseName = name.split(' | ')[1] || name;
            const res = await fetch(`/api/market/search?q=${encodeURIComponent(baseName)}&limit=5`);
            const data = await res.json();
            if (data.data && data.data.length > 0) {
              // Find exact match
              const match = data.data.find((s: any) => s.name === name) || data.data[0];
              if (match?.min_price || match?.current_price) {
                priceMap.set(name, parseFloat(match.min_price || match.current_price));
              }
            }
          } catch { /* skip */ }
        }

        setPrices(priceMap);
      } catch (err) {
        console.error('Failed to fetch case prices:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchPrices();
  }, []);

  // Calculate EV and ROI for each case
  const caseAnalysis = useMemo(() => {
    return CS2_CASES.map(cs => {
      const skinsByRarity: Record<string, CaseSkin[]> = {};
      cs.skins.forEach(s => {
        if (!skinsByRarity[s.rarity]) skinsByRarity[s.rarity] = [];
        skinsByRarity[s.rarity].push(s);
      });

      let expectedValue = 0;
      const skinDetails: { name: string; rarity: string; price: number; dropChance: number; contribution: number }[] = [];

      for (const [rarity, skins] of Object.entries(skinsByRarity)) {
        const rate = (DROP_RATES as any)[rarity] || 0;
        const perSkinRate = skins.length > 0 ? rate / skins.length : 0;

        for (const skin of skins) {
          const price = prices.get(skin.name) || 0;
          const contribution = price * perSkinRate;
          expectedValue += contribution;
          skinDetails.push({
            name: skin.name,
            rarity: skin.rarity,
            price,
            dropChance: perSkinRate * 100,
            contribution,
          });
        }
      }

      // Add knife/glove EV (0.26% chance, ~$350 avg)
      const knifeEV = AVG_KNIFE_VALUE * 0.0026;
      expectedValue += knifeEV;

      const roi = cs.cost > 0 ? ((expectedValue - cs.cost) / cs.cost) * 100 : 0;
      const profitable = expectedValue > cs.cost;

      return {
        ...cs,
        expectedValue,
        roi,
        profitable,
        knifeEV,
        skinDetails: skinDetails.sort((a, b) => b.contribution - a.contribution),
      };
    });
  }, [prices]);

  const sortedCases = useMemo(() => {
    return [...caseAnalysis].sort((a, b) => {
      if (sortBy === 'roi') return b.roi - a.roi;
      if (sortBy === 'ev') return b.expectedValue - a.expectedValue;
      if (sortBy === 'cost') return a.cost - b.cost;
      return a.name.localeCompare(b.name);
    });
  }, [caseAnalysis, sortBy]);

  const overallStats = useMemo(() => {
    const profitable = caseAnalysis.filter(c => c.profitable).length;
    const avgRoi = caseAnalysis.length > 0
      ? caseAnalysis.reduce((s, c) => s + c.roi, 0) / caseAnalysis.length
      : 0;
    const bestCase = [...caseAnalysis].sort((a, b) => b.roi - a.roi)[0];
    const worstCase = [...caseAnalysis].sort((a, b) => a.roi - b.roi)[0];
    return { profitable, total: caseAnalysis.length, avgRoi, bestCase, worstCase };
  }, [caseAnalysis]);

  const rarityColor: Record<string, string> = {
    'Mil-Spec': 'text-blue-400',
    'Restricted': 'text-purple-400',
    'Classified': 'text-pink-400',
    'Covert': 'text-red-400',
    'Extraordinary': 'text-yellow-400',
  };

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">Case Monitor</h1>
          <p className="text-gray-500 text-sm mt-1">Expected value analysis & ROI tracking for CS2 cases</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-500 font-mono mr-2">Sort by:</span>
          {(['roi', 'ev', 'cost', 'name'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                sortBy === s
                  ? 'bg-cyan-glow/10 text-cyan-glow border border-cyan-glow/20'
                  : 'text-gray-500 hover:text-gray-300 border border-transparent'
              }`}
            >
              {s === 'roi' ? 'ROI' : s === 'ev' ? 'EV' : s === 'cost' ? 'Cost' : 'Name'}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="glass-panel p-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-1">Cases Analyzed</p>
          <p className="text-xl font-bold text-white">{overallStats.total}</p>
        </div>
        <div className="glass-panel p-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-1">Profitable Cases</p>
          <p className="text-xl font-bold text-emerald-400">{overallStats.profitable}</p>
        </div>
        <div className="glass-panel p-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-1">Avg ROI</p>
          <p className={`text-xl font-bold ${overallStats.avgRoi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {overallStats.avgRoi >= 0 ? '+' : ''}{overallStats.avgRoi.toFixed(1)}%
          </p>
        </div>
        <div className="glass-panel p-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-1">Best Case</p>
          <p className="text-sm font-bold text-cyan-glow truncate">{overallStats.bestCase?.name || '—'}</p>
          <p className="text-[10px] text-emerald-400 font-mono mt-0.5">
            {overallStats.bestCase ? `${overallStats.bestCase.roi >= 0 ? '+' : ''}${overallStats.bestCase.roi.toFixed(1)}% ROI` : ''}
          </p>
        </div>
      </div>

      {/* Investment Guidance */}
      <div className="glass-panel p-5 border-l-2 border-cyan-glow/30">
        <div className="flex items-start gap-3">
          <BarChart3 className="w-5 h-5 text-cyan-glow flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-white mb-1">Long-Term Investment Guidance</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              {overallStats.profitable > 0
                ? `${overallStats.profitable} out of ${overallStats.total} cases currently have positive expected value. `
                : 'No cases currently have positive expected value from opening. '}
              {overallStats.avgRoi < -20
                ? 'Case opening is heavily negative EV right now — buying skins directly is significantly cheaper than opening cases. Consider investing in case inventories instead, as discontinued cases appreciate 15-40% annually.'
                : overallStats.avgRoi < 0
                ? 'Most cases are slightly negative EV. If you want specific skins, buying directly saves money. However, cases with rare covert skins (Printstream, Head Shot) can occasionally pay off.'
                : 'Some cases are currently positive EV due to high-value skins. This is unusual and may correct as prices adjust. Open these cases while the opportunity exists.'}
            </p>
          </div>
        </div>
      </div>

      {/* Case Cards */}
      {loading ? (
        <div className="text-center py-16">
          <Package className="w-8 h-8 text-cyan-glow/40 mx-auto mb-3 animate-pulse" />
          <p className="text-gray-500 text-sm">Calculating expected values from live market data...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedCases.map(cs => {
            const isExpanded = expandedCase === cs.name;
            return (
              <div key={cs.name} className="glass-panel overflow-hidden">
                {/* Case Header */}
                <button
                  onClick={() => setExpandedCase(isExpanded ? null : cs.name)}
                  className="w-full flex items-center justify-between p-5 hover:bg-white/[0.02] transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border border-white/[0.06] flex items-center justify-center">
                      <Package className="w-5 h-5 text-cyan-glow/60" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-sm font-bold text-white">{cs.name}</h3>
                      <p className="text-[11px] text-gray-500 font-mono">{cs.skins.length} skins + knife/glove</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">Cost</p>
                      <p className="text-sm font-bold text-white font-mono">${cs.cost.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">Expected Value</p>
                      <p className={`text-sm font-bold font-mono ${cs.profitable ? 'text-emerald-400' : 'text-red-400'}`}>
                        ${cs.expectedValue.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right min-w-[80px]">
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">ROI</p>
                      <div className="flex items-center gap-1 justify-end">
                        {cs.roi >= 0
                          ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                          : <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                        }
                        <p className={`text-sm font-bold font-mono ${cs.roi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {cs.roi >= 0 ? '+' : ''}{cs.roi.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {cs.profitable ? (
                        <span className="px-2 py-1 rounded text-[9px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          +EV
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded text-[9px] font-bold uppercase bg-red-500/10 text-red-400 border border-red-500/20">
                          -EV
                        </span>
                      )}
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                    </div>
                  </div>
                </button>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="border-t border-white/[0.04] px-5 py-4">
                    {/* EV Breakdown Bar */}
                    <div className="mb-4">
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-2">EV Contribution by Rarity</p>
                      <div className="flex h-3 rounded-full overflow-hidden bg-carbon-800">
                        {Object.entries(
                          cs.skinDetails.reduce((acc, s) => {
                            acc[s.rarity] = (acc[s.rarity] || 0) + s.contribution;
                            return acc;
                          }, {} as Record<string, number>)
                        ).filter(([, v]) => v > 0).map(([rarity, value]) => (
                          <div
                            key={rarity}
                            style={{ width: `${(value / cs.expectedValue) * 100}%` }}
                            className={`${
                              rarity === 'Mil-Spec' ? 'bg-blue-500' :
                              rarity === 'Restricted' ? 'bg-purple-500' :
                              rarity === 'Classified' ? 'bg-pink-500' :
                              rarity === 'Covert' ? 'bg-red-500' : 'bg-yellow-500'
                            }`}
                            title={`${rarity}: $${value.toFixed(2)}`}
                          />
                        ))}
                        <div
                          style={{ width: `${(cs.knifeEV / cs.expectedValue) * 100}%` }}
                          className="bg-yellow-500"
                          title={`Knife/Glove: $${cs.knifeEV.toFixed(2)}`}
                        />
                      </div>
                      <div className="flex gap-4 mt-2">
                        {['Mil-Spec', 'Restricted', 'Classified', 'Covert'].map(r => (
                          <span key={r} className={`text-[9px] font-mono ${rarityColor[r] || 'text-gray-400'}`}>
                            {r}
                          </span>
                        ))}
                        <span className="text-[9px] font-mono text-yellow-400">Knife/Glove</span>
                      </div>
                    </div>

                    {/* Skin Table */}
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-500 text-[10px] uppercase tracking-widest font-mono border-b border-white/[0.04]">
                          <th className="text-left py-2">Skin</th>
                          <th className="text-left py-2">Rarity</th>
                          <th className="text-right py-2">Drop %</th>
                          <th className="text-right py-2">Market Price</th>
                          <th className="text-right py-2">EV Contribution</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cs.skinDetails.map(s => (
                          <tr key={s.name} className="border-b border-white/[0.02] hover:bg-white/[0.02]">
                            <td className="py-2 text-gray-300 font-medium">{s.name}</td>
                            <td className={`py-2 ${rarityColor[s.rarity] || 'text-gray-400'}`}>{s.rarity}</td>
                            <td className="py-2 text-right text-gray-400 font-mono">{s.dropChance.toFixed(2)}%</td>
                            <td className="py-2 text-right text-white font-mono">
                              {s.price > 0 ? `$${s.price.toFixed(2)}` : <span className="text-gray-600">—</span>}
                            </td>
                            <td className="py-2 text-right font-mono">
                              {s.contribution > 0 ? (
                                <span className="text-cyan-glow">${s.contribution.toFixed(4)}</span>
                              ) : (
                                <span className="text-gray-600">$0.00</span>
                              )}
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t border-white/[0.06]">
                          <td className="py-2 text-yellow-400 font-medium">Knife / Glove (avg)</td>
                          <td className="py-2 text-yellow-400">Extraordinary</td>
                          <td className="py-2 text-right text-gray-400 font-mono">0.26%</td>
                          <td className="py-2 text-right text-white font-mono">~${AVG_KNIFE_VALUE}</td>
                          <td className="py-2 text-right text-cyan-glow font-mono">${cs.knifeEV.toFixed(4)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Cases;
