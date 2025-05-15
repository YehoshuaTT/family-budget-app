// src/components/layout/Sidebar.jsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import { FiGrid, FiRepeat, FiSettings, FiPieChart, FiDollarSign } from 'react-icons/fi'; // אייקונים

const navigationItems = [
  { name: 'דשבורד', to: '/dashboard', icon: FiGrid },
  { name: 'כל הפעולות', to: '/transactions', icon: FiRepeat },
  // { name: 'תקציבים', to: '/budgets', icon: FiPieChart }, // עתידי
  // { name: 'הגדרות', to: '/settings', icon: FiSettings }, // עתידי
];

// שם האפליקציה או לוגו
const AppBranding = () => (
  <div className="flex items-center justify-center h-16 border-b border-slate-700">
    {/* <img src="/logo.svg" alt="לוגו" className="h-8 w-auto" /> */}
    <span className="text-2xl font-bold text-white">מנהל תקציב</span>
  </div>
);

const Sidebar = () => {
  return (
    <div className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:w-64 rtl">
      <div className="flex flex-col flex-grow pt-0 overflow-y-auto bg-slate-800">
        <AppBranding />
        <nav className="mt-5 flex-1 px-2 space-y-1">
          {navigationItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.to}
              end // חשוב ל-NavLink כדי שה-active class יפעל נכון רק לדף הנוכחי
              className={({ isActive }) =>
                `group flex items-center px-3 py-3 text-sm font-medium rounded-md transition-colors duration-150 ease-in-out
                 ${
                   isActive
                     ? 'bg-sky-600 text-white'
                     : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                 }`
              }
            >
              <item.icon className="mr-3 flex-shrink-0 h-5 w-5" aria-hidden="true" />
              {item.name}
            </NavLink>
          ))}
        </nav>
        {/* אפשר להוסיף כאן פוטר לסיידבר אם רוצים */}
      </div>
    </div>
  );
};

export default Sidebar;