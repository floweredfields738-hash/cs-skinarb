import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface PortfolioItem {
  id: string;
  skin_id: string;
  name: string;
  quantity: number;
  average_price: number;
  current_value: number;
  profit_loss_percent: number;
}

interface Portfolio {
  portfolioId: string;
  total_value: number;
  items: PortfolioItem[];
  stats: {
    total_items: number;
    total_quantity: number;
    total_cost: number;
    total_current_value: number;
    total_profit_loss: number;
    profitLossPercent: number;
  };
}

export interface PortfolioState {
  portfolio: Portfolio | null;
  loading: boolean;
  error: string | null;
}

const initialState: PortfolioState = {
  portfolio: null,
  loading: false,
  error: null,
};

const portfolioSlice = createSlice({
  name: 'portfolio',
  initialState,
  reducers: {
    setPortfolio: (state, action: PayloadAction<Portfolio>) => {
      state.portfolio = action.payload;
    },
    updateItem: (state, action: PayloadAction<PortfolioItem>) => {
      if (state.portfolio) {
        const index = state.portfolio.items.findIndex(i => i.id === action.payload.id);
        if (index !== -1) {
          state.portfolio.items[index] = action.payload;
        }
      }
    },
    removeItem: (state, action: PayloadAction<string>) => {
      if (state.portfolio) {
        state.portfolio.items = state.portfolio.items.filter(i => i.id !== action.payload);
      }
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const { setPortfolio, updateItem, removeItem, setLoading, setError } = portfolioSlice.actions;
export default portfolioSlice.reducer;
