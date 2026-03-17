import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../../store/slices/authSlice';
import type { RootState } from '../../store';
import Header from './Header';
import Sidebar from './Sidebar';

const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const dispatch = useDispatch();
  const { user, isAuthenticated } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('authToken');
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
    } catch { /* logout locally even if backend fails */ }
    localStorage.removeItem('authToken');
    dispatch(logout());
  };

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  const handleNavClick = () => {
    if (isMobile) setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen carbon-bg relative">
      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      {isMobile ? (
        <div className={`fixed z-50 h-full transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <Sidebar isOpen={true} onNavClick={handleNavClick} />
        </div>
      ) : (
        <Sidebar isOpen={sidebarOpen} onNavClick={handleNavClick} />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header
          onMenuClick={toggleSidebar}
          userName={user?.username}
          avatarUrl={user?.avatar_url}
          isAuthenticated={isAuthenticated}
          onLogout={handleLogout}
        />

        <main className="flex-1 overflow-auto p-3 md:p-6">
          <div className="fade-in max-w-[1400px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
