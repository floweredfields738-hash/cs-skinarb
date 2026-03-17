import React, { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setUser, setLoading } from './store/slices/authSlice';
import Layout from './components/common/Layout';

// Lazy-load all pages — only download when visited
const Dashboard = lazy(() => import('./pages/Dashboard'));
const SkinDetail = lazy(() => import('./pages/SkinDetail'));
const Portfolio = lazy(() => import('./pages/Portfolio'));
const Arbitrage = lazy(() => import('./pages/Arbitrage'));
const Watchlist = lazy(() => import('./pages/Watchlist'));
const Alerts = lazy(() => import('./pages/Alerts'));
const Settings = lazy(() => import('./pages/Settings'));
const MarketMonitor = lazy(() => import('./pages/MarketMonitor'));
const Cases = lazy(() => import('./pages/Cases'));
const InventoryHub = lazy(() => import('./pages/InventoryHub'));
const TradeJournal = lazy(() => import('./pages/TradeJournal'));
const Calculators = lazy(() => import('./pages/Calculators'));
const Chats = lazy(() => import('./pages/Chats'));
const Marketplace = lazy(() => import('./pages/Marketplace'));
const Copying = lazy(() => import('./pages/Copying'));
const Login = lazy(() => import('./pages/Login'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="w-8 h-8 border-2 border-cyan-glow/30 border-t-cyan-glow rounded-full animate-spin" />
  </div>
);

const App: React.FC = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('authToken');
        if (token) {
          const response = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (response.ok) {
            const data = await response.json();
            dispatch(setUser(data.user));
          } else {
            localStorage.removeItem('authToken');
          }
        }
      } catch (err) {
        console.error('Auth check failed:', err);
      } finally {
        dispatch(setLoading(false));
      }
    };
    checkAuth();
  }, [dispatch]);

  return (
    <Router>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Auth */}
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/auth/verify-email" element={<AuthCallback />} />
          <Route path="/auth/magic-link" element={<AuthCallback />} />

          {/* App */}
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/market-monitor" element={<MarketMonitor />} />
            <Route path="/arbitrage" element={<Arbitrage />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/trades" element={<TradeJournal />} />
            <Route path="/inventory" element={<InventoryHub />} />
            <Route path="/calculators" element={<Calculators />} />
            <Route path="/cases" element={<Cases />} />
            <Route path="/watchlist" element={<Watchlist />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/chats" element={<Chats />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/copying" element={<Copying />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/skins/:id" element={<SkinDetail />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
};

export default App;
