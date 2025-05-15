// src/components/layout/MainLayout.jsx
import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { Outlet } from 'react-router-dom'; // Outlet מרנדר את ה-children routes

const MainLayout = () => {
  // State for mobile sidebar - for future use, not implemented fully here
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden rtl">
      <Sidebar /> {/* Sidebar קבוע לדסקטופ */}
      {/* TODO: Mobile Sidebar (drawer) would go here, controlled by mobileSidebarOpen */}

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onOpenMobileMenu={() => setMobileSidebarOpen(true)} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-100">
          <div className="container mx-auto px-6 py-8">
            <Outlet /> {/* כאן ירונדרו הקומפוננטות של הדפים (למשל, DashboardPage) */}
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;