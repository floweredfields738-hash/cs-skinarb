import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Alert {
  id: string;
  skin_id: string;
  name: string;
  alert_type: string;
  condition: string;
  value: number;
  enabled: boolean;
  triggered_at?: string;
  created_at: string;
}

export interface AlertsState {
  alerts: Alert[];
  triggeredAlerts: Alert[];
  loading: boolean;
  error: string | null;
}

const initialState: AlertsState = {
  alerts: [],
  triggeredAlerts: [],
  loading: false,
  error: null,
};

const alertsSlice = createSlice({
  name: 'alerts',
  initialState,
  reducers: {
    setAlerts: (state, action: PayloadAction<Alert[]>) => {
      state.alerts = action.payload.filter(a => !a.triggered_at);
    },
    setTriggeredAlerts: (state, action: PayloadAction<Alert[]>) => {
      state.triggeredAlerts = action.payload;
    },
    addAlert: (state, action: PayloadAction<Alert>) => {
      state.alerts.push(action.payload);
    },
    removeAlert: (state, action: PayloadAction<string>) => {
      state.alerts = state.alerts.filter(a => a.id !== action.payload);
    },
    triggerAlert: (state, action: PayloadAction<Alert>) => {
      const index = state.alerts.findIndex(a => a.id === action.payload.id);
      if (index !== -1) {
        state.alerts.splice(index, 1);
      }
      state.triggeredAlerts.push(action.payload);
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const {
  setAlerts,
  setTriggeredAlerts,
  addAlert,
  removeAlert,
  triggerAlert,
  setLoading,
  setError,
} = alertsSlice.actions;
export default alertsSlice.reducer;
