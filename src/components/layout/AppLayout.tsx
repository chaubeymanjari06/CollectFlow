import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';

export const AppLayout: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  // Auto-close mobile drawer on route transition
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Desktop Sidebar (visible on md screens and above) */}
      <div className="hidden md:block shrink-0">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Sliding Drawer with Backdrop Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
            data-testid="sidebar-mobile-backdrop"
          />
          <div className="relative w-64 max-w-[80vw] bg-white h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            <Sidebar
              onNavigate={() => setMobileMenuOpen(false)}
              onClose={() => setMobileMenuOpen(false)}
              className="w-full h-full border-r-0"
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)} />
        <main className="flex-1 p-3.5 sm:p-5 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
