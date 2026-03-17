import React, { useState, lazy, Suspense } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { Lock } from 'lucide-react';

const InventoryPage = lazy(() => import('./Inventory'));
const StoragePage = lazy(() => import('./Storage'));

const tabs = [
  { id: 'inventory', label: 'Steam Inventory' },
  { id: 'storage', label: 'Storage Units' },
];

const InventoryHub: React.FC = () => {
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [active, setActive] = useState('inventory');

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center glass-panel p-10 max-w-md">
          <Lock className="w-12 h-12 text-cyan-glow/30 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Sign In Required</h2>
          <p className="text-gray-500 text-sm mb-6">Sign in to view your inventory and storage containers.</p>
          <a href="/login" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-glow text-carbon-950 font-bold text-sm">Sign In</a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">Inventory</h1>
        <p className="text-sm text-gray-500 mt-1">Your Steam inventory and storage container contents</p>
      </div>

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

      <Suspense fallback={<div className="text-center py-10 text-gray-500 text-sm">Loading...</div>}>
        {active === 'inventory' && <InventoryPage />}
        {active === 'storage' && <StoragePage />}
      </Suspense>
    </div>
  );
};

export default InventoryHub;
