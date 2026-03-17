import { useState, useEffect, useRef } from 'react';
import { subscribe, PriceUpdate, ArbitrageUpdate, MarketSummary, connectSocket } from '../api/socket';
import { marketApi, arbitrageApi, skinsApi } from '../api/services';

// ─── Price Updates Stream ────────────────────────────
export function usePriceUpdates() {
  const [updates, setUpdates] = useState<PriceUpdate['data'][]>([]);
  const updatesRef = useRef<PriceUpdate['data'][]>([]);

  useEffect(() => {
    connectSocket();
    const unsub = subscribe('price_update', (event: PriceUpdate) => {
      const newUpdate = event.data || event;
      updatesRef.current = [newUpdate, ...updatesRef.current].slice(0, 50);
      setUpdates([...updatesRef.current]);
    });
    return unsub;
  }, []);

  return updates;
}

// ─── Arbitrage Updates Stream ────────────────────────
export function useArbitrageUpdates() {
  const [opportunities, setOpportunities] = useState<ArbitrageUpdate['data'][]>([]);

  useEffect(() => {
    connectSocket();
    const unsub = subscribe('arbitrage_update', (event: ArbitrageUpdate) => {
      const newOpp = event.data || event;
      setOpportunities((prev) => {
        const filtered = prev.filter((o) => !(o.skinId === newOpp.skinId && o.sourceMarket === newOpp.sourceMarket && o.targetMarket === newOpp.targetMarket));
        return [newOpp, ...filtered].slice(0, 30);
      });
    });
    return unsub;
  }, []);

  return opportunities;
}

// ─── Market Summary Stream ───────────────────────────
export function useMarketSummary() {
  const [summary, setSummary] = useState<MarketSummary['data'] | null>(null);

  useEffect(() => {
    connectSocket();
    const unsub = subscribe('market_summary', (event: MarketSummary) => {
      setSummary(event.data || event);
    });
    return unsub;
  }, []);

  return summary;
}

// ─── Market Index (total market value) ───────────────
export interface MarketIndexPoint {
  totalValue: number;
  skinCount: number;
  time: number;
}

export function useMarketIndex() {
  const [points, setPoints] = useState<MarketIndexPoint[]>([]);
  const pointsRef = useRef<MarketIndexPoint[]>([]);
  const loadedRef = useRef(false);

  useEffect(() => {
    // Load historical data on mount
    if (!loadedRef.current) {
      loadedRef.current = true;
      const apiUrl = '/api';
      fetch(`${apiUrl}/skins/market-index/history?range=24h`)
        .then(r => r.json())
        .then(data => {
          if (data.success && data.data?.length) {
            pointsRef.current = data.data;
            setPoints([...pointsRef.current]);
          }
        })
        .catch(() => {});
    }

    connectSocket();
    const unsub = subscribe('market_index', (event: any) => {
      const d = event.data || event;
      const point: MarketIndexPoint = {
        totalValue: d.totalValue || 0,
        skinCount: d.skinCount || 0,
        time: new Date(d.timestamp || Date.now()).getTime(),
      };
      pointsRef.current.push(point);
      if (pointsRef.current.length > 10000) {
        pointsRef.current = pointsRef.current.slice(-10000);
      }
      setPoints([...pointsRef.current]);
    });
    return unsub;
  }, []);

  return points;
}

// ─── Connection Status ───────────────────────────────
export function useConnectionStatus() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    connectSocket();
    const unsub = subscribe('connection', (data: { connected: boolean }) => {
      setConnected(data.connected);
    });
    return unsub;
  }, []);

  return connected;
}

// ─── Fetch + Live Market Stats ───────────────────────
export function useLiveMarketStats() {
  const [stats, setStats] = useState({
    totalVolume24h: 0,
    activeSkins: 0,
    avgChange24h: 0,
    arbitrageCount: 0,
    topGainer: { name: '—', change: 0 },
    topLoser: { name: '—', change: 0 },
  });

  // Fetch initial stats from API
  useEffect(() => {
    marketApi.getSummary().then((res) => {
      if (res.data) {
        setStats((prev) => ({ ...prev, ...res.data }));
      }
    }).catch(() => {});
  }, []);

  // Update from WebSocket
  useEffect(() => {
    connectSocket();
    const unsub = subscribe('market_summary', (event: MarketSummary) => {
      const d = event.data || event;
      setStats({
        totalVolume24h: d.totalVolume24h || 0,
        activeSkins: d.activeSkins || 0,
        avgChange24h: d.avgChange24h || 0,
        arbitrageCount: d.arbitrageCount || 0,
        topGainer: d.topGainer || { name: '—', change: 0 },
        topLoser: d.topLoser || { name: '—', change: 0 },
      });
    });
    return unsub;
  }, []);

  return stats;
}

// ─── Fetch + Live Arbitrage List ─────────────────────
export function useLiveArbitrage() {
  const [data, setData] = useState<any[]>([]);
  const [bestOpp, setBestOpp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  const mapItem = (item: any) => ({
    skin_name: item.name || item.skin_name,
    source_market: item.source_market,
    target_market: item.target_market,
    buy_price: item.buy_price,
    sell_price: item.sell_price,
    net_profit: item.net_profit,
    roi: item.roi,
    risk_level: item.risk_level,
    profit_margin: item.profit_margin,
    created_at: item.created_at,
    skin_id: item.skin_id,
    exterior: item.exterior || null,
  });

  // Fetch initial data from API
  useEffect(() => {
    arbitrageApi.list({ limit: 50 }).then((res) => {
      const payload = res.data;
      const items = Array.isArray(payload) ? payload
        : Array.isArray(payload?.data) ? payload.data
        : payload?.rows || [];
      if (items.length > 0) {
        const mapped = items.map(mapItem);
        setData(mapped);
        setBestOpp(mapped[0] || null);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Subscribe to 10-second arbitrage list broadcasts
  useEffect(() => {
    connectSocket();
    const unsub = subscribe('arbitrage_list', (event: any) => {
      const d = event.data || event;
      const opps = d.opportunities || [];
      if (opps.length > 0) {
        const mapped = opps.map(mapItem);
        setData(mapped);
        setBestOpp(d.bestOpportunity ? mapItem(d.bestOpportunity) : mapped[0]);
        setLastRefresh(Date.now());
      }
    });
    return unsub;
  }, []);

  // Merge live updates
  useEffect(() => {
    connectSocket();
    const unsub = subscribe('arbitrage_update', (event: ArbitrageUpdate) => {
      const newOpp = event.data || event;
      setData((prev) => {
        const idx = prev.findIndex((o: any) =>
          o.skin_id === newOpp.skinId && o.source_market === newOpp.sourceMarket && o.target_market === newOpp.targetMarket
        );
        const mapped = {
          skin_id: newOpp.skinId,
          skin_name: newOpp.skinName,
          source_market: newOpp.sourceMarket,
          target_market: newOpp.targetMarket,
          buy_price: newOpp.buyPrice,
          sell_price: newOpp.sellPrice,
          net_profit: newOpp.profit,
          roi: newOpp.roi,
          risk_level: newOpp.riskLevel,
          created_at: newOpp.timestamp,
          _flash: true,
        };
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = mapped;
          return copy;
        }
        return [mapped, ...prev].slice(0, 30);
      });
    });
    return unsub;
  }, []);

  return { data, loading, bestOpp, lastRefresh };
}

// ─── Fetch + Live Skin Prices ────────────────────────
export function useLiveSkinPrices(skinId?: string) {
  const [prices, setPrices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!skinId) return;
    marketApi.getPrices({ skinId }).then((res) => {
      if (res.data) setPrices(Array.isArray(res.data) ? res.data : res.data.rows || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [skinId]);

  useEffect(() => {
    if (!skinId) return;
    connectSocket();
    const unsub = subscribe('price_update', (event: PriceUpdate) => {
      const d = event.data || event;
      if (String(d.skinId) === skinId) {
        setPrices((prev) => prev.map((p: any) =>
          p.market_id === d.marketId ? { ...p, price: d.newPrice, volume: d.volume, last_updated: d.timestamp } : p
        ));
      }
    });
    return unsub;
  }, [skinId]);

  return { prices, loading };
}

// ─── Live Price Feed (for ticker / dashboard) ────────
export function useLivePriceFeed(maxItems = 10) {
  const [feed, setFeed] = useState<PriceUpdate['data'][]>([]);

  // Seed with real market data + real price changes from history
  useEffect(() => {
    fetch(`/api/market/feed?limit=${maxItems}`)
      .then(r => r.json())
      .then(data => {
        const rawItems = data?.data || [];
        if (Array.isArray(rawItems) && rawItems.length > 0) {
          const items = rawItems.slice(0, maxItems).map((p: any) => ({
            skinId: p.skin_id,
            skinName: p.name || p.skin_name || `Skin #${p.skin_id}`,
            marketId: p.market_id,
            marketName: p.market_name || 'Market',
            oldPrice: parseFloat(p.previous_price || p.price || 0),
            newPrice: parseFloat(p.price || p.new_price || 0),
            change: parseFloat(p.change || 0),
            changePercent: parseFloat(p.change_percent || 0),
            volume: p.volume || 0,
            timestamp: p.last_updated || new Date().toISOString(),
          }));
          setFeed(items);
        }
      })
      .catch(() => {
        // Fallback: fetch raw prices without change data
        fetch(`/api/market/prices?limit=${maxItems}`)
          .then(r => r.json())
          .then(data => {
            const rawItems = data?.data?.prices || data?.data || [];
            if (Array.isArray(rawItems) && rawItems.length > 0) {
              setFeed(rawItems.slice(0, maxItems).map((p: any) => ({
                skinId: p.skin_id,
                skinName: p.name || p.skin_name || `Skin #${p.skin_id}`,
                marketId: p.market_id,
                marketName: p.market_name || 'Market',
                oldPrice: parseFloat(p.price),
                newPrice: parseFloat(p.price),
                change: 0,
                changePercent: 0,
                volume: p.volume || 0,
                timestamp: new Date().toISOString(),
              })));
            }
          }).catch(() => {});
      });
  }, [maxItems]);

  // Overlay live updates
  useEffect(() => {
    connectSocket();
    const unsub = subscribe('price_update', (event: PriceUpdate) => {
      const d = event.data || event;
      setFeed((prev) => [d, ...prev].slice(0, maxItems));
    });
    return unsub;
  }, [maxItems]);

  return feed;
}

// ─── All Skins with Live Price Merge ─────────────────
export function useLiveSkinsList() {
  const [skins, setSkins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    skinsApi.list({ limit: 50 }).then((res) => {
      const payload = res.data;
      const items = Array.isArray(payload) ? payload
        : Array.isArray(payload?.data) ? payload.data
        : payload?.rows || [];
      setSkins(items);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    connectSocket();
    const unsub = subscribe('price_update', (event: PriceUpdate) => {
      const d = event.data || event;
      setSkins((prev) => prev.map((s: any) =>
        s.id === d.skinId ? { ...s, current_price: d.newPrice, change_24h: d.changePercent, _flash: true } : s
      ));
    });
    return unsub;
  }, []);

  return { skins, loading };
}
