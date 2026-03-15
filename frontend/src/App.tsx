import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setUser, setLoading } from './store/slices/authSlice';

// Pages
import Dashboard from './pages/Dashboard';
import SkinDetail from './pages/SkinDetail';
import Portfolio from './pages/Portfolio';
import Arbitrage from './pages/Arbitrage';
import Watchlist from './pages/Watchlist';
import Alerts from './pages/Alerts';
import Settings from './pages/Settings';
import MarketMonitor from './pages/MarketMonitor';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';

// Components
import Layout from './components/common/Layout';

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
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Main app routes - accessible without auth */}
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/skins/:id" element={<SkinDetail />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/arbitrage" element={<Arbitrage />} />
          <Route path="/watchlist" element={<Watchlist />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/market-monitor" element={<MarketMonitor />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

export default App;
