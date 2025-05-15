// src/components/layout/Sidebar.jsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import { FiGrid, FiRepeat, FiSettings, FiPieChart, FiX, FiDollarSign } from 'react-icons/fi'; // הוספתי FiX

const navigationItems = [
  { name: 'דשבורד', to: '/dashboard', icon: FiGrid },
  { name: 'כל הפעולות', to: '/transactions', icon: FiRepeat },
  // { name: 'הכנסות', to: '/incomes', icon: FiDollarSign }, // אם תרצה קישור נפרד להכנסות
  // { name: 'תקציבים', to: '/budgets', icon: FiPieChart },
  { name: 'הגדרות', to: '/settings', icon: FiSettings }, 
];

const AppBranding = ({isMobile = false}) => ( // isMobile prop to slightly change style if needed
  <div className={`flex items-center justify-center h-16 px-4 ${isMobile ? 'border-b border-slate-700' : 'border-b border-slate-700'}`}>
    {/* <img src="/logo.svg" alt="לוגו" className="h-8 w-auto" /> */}
    <span className={`text-xl font-bold text-white truncate ${isMobile ? '' : 'md:text-2xl'}`}>מנהל תקציב</span>
  </div>
);

const Sidebar = ({ isOpen, onClose }) => { // isOpen ו-onClose משמשים למובייל
  
  const navLinkClasses = ({ isActive }) =>
    `group flex items-center px-3 py-3 text-sm font-medium rounded-md transition-colors duration-150 ease-in-out
     ${
       isActive
         ? 'bg-sky-600 text-white shadow-md'
         : 'text-slate-300 hover:bg-slate-700 hover:text-white'
     }`;

  const mobileNavLinkClasses = ({ isActive }) => // גודל פונט ואייקונים מעט גדולים יותר למובייל
  `group flex items-center px-3 py-3 text-base font-medium rounded-md
     ${
       isActive
         ? 'bg-sky-600 text-white'
         : 'text-slate-300 hover:bg-slate-700 hover:text-white'
     }`;

  return (
    <>
      {/* --- Sidebar for Desktop (Fixed) --- */}
      <div className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:w-64 rtl"> {/* md:w-64 for desktop */}
        <div className="flex flex-col flex-grow pt-0 overflow-y-auto bg-slate-800 shadow-lg">
          <AppBranding />
          <nav className="mt-5 flex-1 px-2 space-y-1">
            {navigationItems.map((item) => (
              <NavLink
                key={`desktop-${item.name}`}
                to={item.to}
                end
                className={navLinkClasses}
              >
                <item.icon className="mr-3 flex-shrink-0 h-5 w-5" aria-hidden="true" />
                {item.name}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      {/* --- Sidebar for Mobile (Drawer) --- */}
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black bg-opacity-75 transition-opacity duration-300 ease-linear md:hidden"
          onClick={onClose}
          aria-hidden="true"
        ></div>
      )}
      {/* Panel */}
      <div
        className={`fixed inset-y-0 z-40 flex flex-col w-64 bg-slate-800 shadow-xl transform transition-transform duration-300 ease-in-out md:hidden
                   ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
                   rtl:right-0 rtl:left-auto rtl:-translate-x-0 ${isOpen ? 'rtl:translate-x-0' : 'rtl:translate-x-full'}`} // Corrected RTL transform
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-700">
          <AppBranding isMobile={true} />
          <button
            onClick={onClose}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-full -mr-2" // Negative margin to align nicely
            aria-label="סגור תפריט"
          >
            <FiX className="h-6 w-6" />
          </button>
        </div>
        <nav className="mt-5 flex-1 px-2 space-y-1">
          {navigationItems.map((item) => (
            <NavLink
              key={`mobile-${item.name}`}
              to={item.to}
              end
              onClick={onClose} // Close sidebar on link click
              className={mobileNavLinkClasses}
            >
              <item.icon className="mr-4 flex-shrink-0 h-6 w-6" aria-hidden="true" />
              {item.name}
            </NavLink>
          ))}
        </nav>
        {/* Optional: Footer in mobile sidebar */}
        {/* <div className="p-4 border-t border-slate-700">
          <p className="text-xs text-slate-400">App Version 1.0.0</p>
        </div> */}
      </div>
    </>
  );
};

export default Sidebar;