// src/components/layout/MainLayout.jsx
import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header'; // Header כבר לא צריך לקבל onOpenMobileMenu אם הוא חלק מה-Layout הזה
import { Outlet } from 'react-router-dom';

const SIDEBAR_WIDTH_CLASS = "md:w-64"; // רוחב הסיידבר כפי שהוגדר בו

const MainLayout = () => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false); // ישמש בעתיד למובייל

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden rtl">
      <Sidebar /> {/* Sidebar - כבר מוגדר לו w-64 ו-fixed */}
      
      {/* Mobile menu overlay (for future use) */}
      {/* {mobileSidebarOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black bg-opacity-50 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        ></div>
      )} */}
      {/* Mobile sidebar itself (for future use) */}

      {/* Main content area */}
      <div className={`flex-1 flex flex-col overflow-hidden md:mr-[16rem]`}> {/* 16rem = w-64 ב-Tailwind. ב-RTL זה mr, ב-LTR זה ml */}
        {/* ה-Header צריך להיות חלק מהאזור הזה, ולא מחושב ב-offset של הסיידבר בנפרד */}
        <Header onOpenMobileMenu={() => setMobileSidebarOpen(true)} /> {/* Header מקבל את כל הרוחב הנותר */}
        
        <main className="flex-1 overflow-x-hidden overflow-y-auto"> {/* הסר את bg-slate-100 מכאן, הוא על ה-div החיצוני */}
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8"> {/* הוספתי padding כללי */}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;