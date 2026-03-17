import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { Box, Plus, Trash2, Search, X, Lock, ChevronDown, ChevronUp, Edit3, Check } from 'lucide-react';

const Storage: React.FC = () => {
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [containers, setContainers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalContainers: 0, totalItems: 0, grandTotal: 0 });
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [newContainerName, setNewContainerName] = useState('');
  const [showAddItem, setShowAddItem] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [editingName, setEditingName] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const token = localStorage.getItem('authToken');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchContainers = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/storage', { headers });
      const data = await res.json();
      if (data.success) {
        setContainers(data.containers || []);
        setStats({ totalContainers: data.totalContainers, totalItems: data.totalItems, grandTotal: data.grandTotal });
      }
    } catch {} finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchContainers(); }, [fetchContainers]);

  const createContainer = async () => {
    if (!newContainerName.trim()) return;
    await fetch('/api/storage', { method: 'POST', headers, body: JSON.stringify({ name: newContainerName }) });
    setNewContainerName('');
    fetchContainers();
  };

  const deleteContainer = async (id: number) => {
    if (!confirm('Delete this container and all its items?')) return;
    await fetch(`/api/storage/${id}`, { method: 'DELETE', headers });
    fetchContainers();
  };

  const renameContainer = async (id: number) => {
    await fetch(`/api/storage/${id}`, { method: 'PUT', headers, body: JSON.stringify({ name: editName }) });
    setEditingName(null);
    fetchContainers();
  };

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

  const addItem = async (containerId: number, skin: any) => {
    await fetch(`/api/storage/${containerId}/items`, {
      method: 'POST', headers,
      body: JSON.stringify({ skinId: skin.id, customName: skin.name }),
    });
    setShowAddItem(null);
    setSearchQuery('');
    setSearchResults([]);
    fetchContainers();
  };

  const removeItem = async (containerId: number, itemId: number) => {
    await fetch(`/api/storage/${containerId}/items/${itemId}`, { method: 'DELETE', headers });
    fetchContainers();
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center glass-panel p-10 max-w-md">
          <Lock className="w-12 h-12 text-cyan-glow/30 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Sign In Required</h2>
          <p className="text-gray-500 text-sm mb-6">Sign in to track your storage containers.</p>
          <a href="/login" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-glow text-carbon-950 font-bold text-sm">Sign In</a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-panel p-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-1">Containers</p>
          <p className="text-xl font-bold text-white">{stats.totalContainers}</p>
        </div>
        <div className="glass-panel p-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-1">Total Items</p>
          <p className="text-xl font-bold text-cyan-glow">{stats.totalItems}</p>
        </div>
        <div className="glass-panel p-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-1">Total Value</p>
          <p className="text-xl font-bold text-emerald-400 font-mono">${stats.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      {/* Create container */}
      <div className="flex gap-3">
        <input type="text" value={newContainerName} onChange={e => setNewContainerName(e.target.value)}
          placeholder="New container name (e.g. Knives, Investment, etc.)"
          onKeyDown={e => e.key === 'Enter' && createContainer()}
          className="flex-1 px-4 py-3 rounded-xl bg-carbon-800/80 border border-white/[0.06] text-white text-sm focus:outline-none focus:border-cyan-glow/30" />
        <button onClick={createContainer} disabled={!newContainerName.trim()}
          className="px-5 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-600 to-cyan-glow text-carbon-950 hover:shadow-glow-cyan transition-all disabled:opacity-40">
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Containers */}
      {loading ? (
        <div className="text-center py-10">
          <Box className="w-8 h-8 text-cyan-glow/30 mx-auto mb-3 animate-pulse" />
          <p className="text-gray-500 text-sm">Loading containers...</p>
        </div>
      ) : containers.length === 0 ? (
        <div className="text-center py-10 glass-panel">
          <Box className="w-8 h-8 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No containers yet</p>
          <p className="text-gray-600 text-xs mt-1">Create one above to start cataloging your storage units</p>
        </div>
      ) : (
        <div className="space-y-3">
          {containers.map(c => {
            const isExpanded = expandedId === c.id;
            return (
              <div key={c.id} className="glass-panel overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : c.id)}
                  className="w-full flex items-center justify-between p-5 hover:bg-white/[0.02] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <Box className="w-5 h-5 text-cyan-glow/50" />
                    {editingName === c.id ? (
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                          className="px-2 py-1 rounded bg-carbon-800 border border-cyan-glow/20 text-white text-sm focus:outline-none"
                          onKeyDown={e => e.key === 'Enter' && renameContainer(c.id)} autoFocus />
                        <button onClick={() => renameContainer(c.id)} className="text-emerald-400"><Check className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <div>
                        <span className="text-sm font-bold text-white">{c.name}</span>
                        <span className="text-[10px] text-gray-600 ml-2 font-mono">{c.itemCount} items</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-bold text-emerald-400 font-mono">${c.totalValue.toFixed(2)}</span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-white/[0.04] px-5 py-4">
                    {/* Actions */}
                    <div className="flex gap-2 mb-4">
                      <button onClick={(e) => { e.stopPropagation(); setShowAddItem(c.id); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] text-cyan-glow bg-cyan-glow/10 border border-cyan-glow/20 hover:bg-cyan-glow/20 transition-all">
                        <Plus className="w-3 h-3" /> Add Item
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setEditingName(c.id); setEditName(c.name); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] text-gray-500 border border-white/[0.06] hover:text-white transition-all">
                        <Edit3 className="w-3 h-3" /> Rename
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); deleteContainer(c.id); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] text-red-400/50 border border-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all ml-auto">
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>

                    {/* Add item search */}
                    {showAddItem === c.id && (
                      <div className="mb-4 relative">
                        <div className="flex gap-2 items-center mb-2">
                          <Search className="w-4 h-4 text-gray-500" />
                          <input type="text" value={searchQuery} onChange={e => handleSearch(e.target.value)}
                            placeholder="Search skin to add..." autoFocus
                            className="flex-1 px-3 py-2 rounded-lg bg-carbon-800/80 border border-white/[0.06] text-white text-sm focus:outline-none focus:border-cyan-glow/30" />
                          <button onClick={() => { setShowAddItem(null); setSearchQuery(''); setSearchResults([]); }} className="text-gray-500">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        {searchResults.length > 0 && (
                          <div className="space-y-1">
                            {searchResults.map(s => (
                              <button key={s.id} onClick={() => addItem(c.id, s)}
                                className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/[0.04] transition-all flex justify-between text-sm">
                                <span className="text-white">{s.name}</span>
                                {s.current_price && <span className="text-gray-500 font-mono">${parseFloat(s.current_price).toFixed(2)}</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Items list */}
                    {c.items.length === 0 ? (
                      <p className="text-gray-600 text-xs text-center py-4">No items — add skins to track their value</p>
                    ) : (
                      <div className="space-y-1">
                        {c.items.map((item: any) => (
                          <div key={item.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/[0.02] transition-all">
                            <div>
                              <p className="text-[12px] text-white">{item.skin_name || item.custom_name || 'Unknown'}</p>
                              {item.exterior && <span className="text-[9px] text-gray-600 font-mono">{item.exterior}</span>}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-[12px] text-emerald-400 font-mono">
                                {item.market_price ? `$${item.market_price.toFixed(2)}` : '—'}
                              </span>
                              <button onClick={() => removeItem(c.id, item.id)} className="text-gray-700 hover:text-red-400 transition-colors">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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

export default Storage;
