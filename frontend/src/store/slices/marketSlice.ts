import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface MarketPrice {
  skin_id: string;
  name: string;
  market_id: string;
  price: number;
  volume: number;
  timestamp: string;
}

interface Skin {
  id: string;
  name: string;
  rarity: string;
  image_url: string;
  current_price: number;
  volume_7d: number;
  trend: number;
  opportunity_score: number;
}

interface ArbitrageOpportunity {
  id: string;
  skin_id: string;
  name: string;
  source_market: string;
  target_market: string;
  buy_price: number;
  sell_price: number;
  roi: number;
  risk_level: string;
}

export interface MarketState {
  prices: MarketPrice[];
  skins: Skin[];
  arbitrage: ArbitrageOpportunity[];
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

const initialState: MarketState = {
  prices: [],
  skins: [],
  arbitrage: [],
  loading: false,
  error: null,
  lastUpdated: null,
};

const marketSlice = createSlice({
  name: 'market',
  initialState,
  reducers: {
    setPrices: (state, action: PayloadAction<MarketPrice[]>) => {
      state.prices = action.payload;
      state.lastUpdated = new Date().toISOString();
    },
    setSkins: (state, action: PayloadAction<Skin[]>) => {
      state.skins = action.payload;
    },
    setArbitrage: (state, action: PayloadAction<ArbitrageOpportunity[]>) => {
      state.arbitrage = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    updateSkinPrice: (state, action: PayloadAction<{ skinId: string; price: number }>) => {
      const skin = state.skins.find(s => s.id === action.payload.skinId);
      if (skin) {
        skin.current_price = action.payload.price;
      }
    },
  },
});

export const { setPrices, setSkins, setArbitrage, setLoading, setError, updateSkinPrice } = marketSlice.actions;
export default marketSlice.reducer;
