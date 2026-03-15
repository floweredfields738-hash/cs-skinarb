import client from './client';

// ─── Skins ───────────────────────────────────────────
export const skinsApi = {
  list: (params?: { page?: number; limit?: number; search?: string; rarity?: string; sort?: string }) =>
    client.get('/skins', { params }),
  getById: (id: string) =>
    client.get(`/skins/${id}`),
  getHistory: (id: string, days = 30) =>
    client.get(`/skins/${id}/history`, { params: { days } }),
  getAnalysis: (id: string) =>
    client.get(`/skins/${id}/analysis`),
  getTrending: () =>
    client.get('/skins/trending/opportunity'),
};

// ─── Market ──────────────────────────────────────────
export const marketApi = {
  getPrices: (params?: { skinId?: string; marketId?: string }) =>
    client.get('/market/prices', { params }),
  getTrends: () =>
    client.get('/market/trends'),
  getLeaders: () =>
    client.get('/market/leaders'),
  getStats: () =>
    client.get('/market/stats'),
  getHeatmap: () =>
    client.get('/market/heatmap'),
  compareSkin: (skinId: string) =>
    client.get(`/market/compare/${skinId}`),
  getFeed: () =>
    client.get('/market/feed'),
  getSummary: () =>
    client.get('/market/summary'),
  getCandles: (params: { skin_id: number; market_id?: number; interval?: string; limit?: number }) =>
    client.get('/market/candles', { params }),
  searchSkins: (q: string, limit?: number) =>
    client.get('/market/search', { params: { q, limit } }),
};

// ─── Arbitrage ───────────────────────────────────────
export const arbitrageApi = {
  list: (params?: { minProfit?: number; riskLevel?: string; page?: number; limit?: number }) =>
    client.get('/arbitrage', { params }),
  getById: (id: string) =>
    client.get(`/arbitrage/${id}`),
  getStats: () =>
    client.get('/arbitrage/stats/overview'),
  getByRisk: (level: string) =>
    client.get(`/arbitrage/filter/by-risk`, { params: { level } }),
  getByMarketPair: (source: string, target: string) =>
    client.get(`/arbitrage/market-pair/${source}/${target}`),
  simulate: (id: string) =>
    client.post(`/arbitrage/${id}/simulate`),
};

// ─── Portfolio ───────────────────────────────────────
export const portfolioApi = {
  get: () =>
    client.get('/portfolio'),
  getPerformance: (period: string) =>
    client.get(`/portfolio/performance/${period}`),
  getItem: (skinId: string) =>
    client.get(`/portfolio/items/${skinId}`),
  addItem: (data: { skin_id: string; quantity: number; purchase_price: number }) =>
    client.post('/portfolio/items/add', data),
  removeItem: (itemId: string) =>
    client.delete(`/portfolio/items/${itemId}`),
  importInventory: () =>
    client.post('/portfolio/import-inventory'),
  getDiversification: () =>
    client.get('/portfolio/analysis/diversification'),
};

// ─── Alerts ──────────────────────────────────────────
export const alertsApi = {
  list: (params?: { status?: string }) =>
    client.get('/alerts', { params }),
  create: (data: { skin_id: string; alert_type: string; condition: string; threshold: number }) =>
    client.post('/alerts', data),
  update: (alertId: string, data: Partial<{ condition: string; threshold: number; is_active: boolean }>) =>
    client.put(`/alerts/${alertId}`, data),
  delete: (alertId: string) =>
    client.delete(`/alerts/${alertId}`),
  getTriggered: () =>
    client.get('/alerts/history/triggered'),
  getStats: () =>
    client.get('/alerts/stats/overview'),
  acknowledge: (alertId: string) =>
    client.post(`/alerts/${alertId}/acknowledge`),
  test: (alertId: string) =>
    client.post(`/alerts/${alertId}/test`),
};

// ─── Auth ────────────────────────────────────────────
export const authApi = {
  getMe: () =>
    client.get('/auth/me'),
  refresh: () =>
    client.post('/auth/refresh'),
  logout: () =>
    client.post('/auth/logout'),
};
