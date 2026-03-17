import { io, Socket } from 'socket.io-client';

// Connect to backend — use proxy in dev, direct in production
const SOCKET_URL = window.location.hostname === 'localhost'
  ? 'https://cs-skin-backend-production.up.railway.app'
  : window.location.origin;

let socket: Socket | null = null;

// Typed event data
export interface PriceUpdate {
  type: 'price_update';
  data: {
    skinId: number;
    skinName: string;
    marketId: number;
    marketName: string;
    oldPrice: number;
    newPrice: number;
    change: number;
    changePercent: number;
    volume: number;
    timestamp: string;
  };
}

export interface ArbitrageUpdate {
  type: 'arbitrage_update';
  data: {
    skinId: number;
    skinName: string;
    sourceMarket: string;
    targetMarket: string;
    buyPrice: number;
    sellPrice: number;
    profit: number;
    roi: number;
    riskLevel: string;
    timestamp: string;
  };
}

export interface MarketSummary {
  type: 'market_summary';
  data: {
    totalVolume24h: number;
    activeSkins: number;
    avgChange24h: number;
    topGainer: { name: string; change: number };
    topLoser: { name: string; change: number };
    arbitrageCount: number;
    timestamp: string;
  };
}

// Event listeners registry
type Listener = (data: any) => void;
const listeners: Map<string, Set<Listener>> = new Map();

export function subscribe(event: string, callback: Listener) {
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }
  listeners.get(event)!.add(callback);
  return () => {
    listeners.get(event)?.delete(callback);
  };
}

function emit(event: string, data: any) {
  listeners.get(event)?.forEach((cb) => cb(data));
}

export function connectSocket(): Socket {
  // True singleton — if socket exists (connected or connecting), return it
  if (socket) return socket;

  socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on('connect', () => {
    console.log('[WS] Connected to server');
    socket!.emit('subscribe:market');
    socket!.emit('subscribe:arbitrage');
    emit('connection', { connected: true });
  });

  socket.on('disconnect', (reason) => {
    console.log('[WS] Disconnected:', reason);
    emit('connection', { connected: false });
  });

  // Market price updates
  socket.on('market:update', (data: PriceUpdate) => {
    emit('price_update', data);
  });

  // Arbitrage opportunity updates
  socket.on('arbitrage:update', (data: ArbitrageUpdate) => {
    emit('arbitrage_update', data);
  });

  // Market summary broadcasts
  socket.on('market:summary', (data: MarketSummary) => {
    emit('market_summary', data);
  });

  // Market index (total market value)
  socket.on('market:index', (data: any) => {
    emit('market_index', data);
  });

  // Arbitrage list (full refresh every 10s)
  socket.on('arbitrage:list', (data: any) => {
    emit('arbitrage_list', data);
  });

  // Also listen for generic broadcast events
  socket.on('market:price', (data: any) => {
    emit('price_update', data);
  });

  socket.on('arbitrage:opportunity', (data: any) => {
    emit('arbitrage_update', data);
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket(): Socket | null {
  return socket;
}
