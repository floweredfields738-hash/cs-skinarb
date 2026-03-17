import React, { useState, lazy, Suspense } from 'react';

const FloatChecker = lazy(() => import('./FloatChecker'));
const TradeUp = lazy(() => import('./TradeUp'));
const StickerCalc = lazy(() => import('./StickerCalc'));
const Backtester = lazy(() => import('./Backtester'));

const tabs = [
  { id: 'float', label: 'Float Checker' },
  { id: 'tradeup', label: 'Trade-Up' },
  { id: 'sticker', label: 'Sticker Premium' },
  { id: 'backtest', label: 'Profit Simulator' },
];

const Calculators: React.FC = () => {
  const [active, setActive] = useState('float');

  return (
    <div className="space-y-6 fade-in">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">Calculators</h1>
        <p className="text-sm text-gray-500 mt-1">Tools for evaluating skins, trade-ups, and profit potential</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-carbon-800/50 p-1 rounded-xl border border-white/[0.04]">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              active === t.id
                ? 'bg-cyan-glow/10 text-cyan-glow border border-cyan-glow/20'
                : 'text-gray-500 hover:text-gray-300 border border-transparent'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <Suspense fallback={<div className="text-center py-10 text-gray-500 text-sm">Loading...</div>}>
        {active === 'float' && <FloatChecker />}
        {active === 'tradeup' && <TradeUp />}
        {active === 'sticker' && <StickerCalc />}
        {active === 'backtest' && <Backtester />}
      </Suspense>
    </div>
  );
};

export default Calculators;
