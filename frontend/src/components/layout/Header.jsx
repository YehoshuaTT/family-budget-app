// src/components/layout/Header.jsx
import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { FiLogOut, FiUser, FiMenu } from 'react-icons/fi';

// הפונקציה הזו תהיה זמינה אם תרצה להוסיף כפתור לפתיחת/סגירת הסיידבר במובייל
const MobileMenuButton = ({ onOpenMobileMenu }) => (
  <div className="md:hidden">
    <button
      onClick={onOpenMobileMenu}
      className="p-2 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 focus:outline-none"
    >
      <FiMenu className="h-6 w-6" />
    </button>
  </div>
);


const Header = ({ onOpenMobileMenu }) => { // onOpenMobileMenu הוא prop אופציונלי
  const { user, logout } = useAuth();

  return (
    <header className="bg-white shadow-sm sticky top-0 z-40 rtl"> {/* z-40 to be under sidebar if it overlaps */}
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 md:ml-64"> {/* md:ml-64 for when sidebar is fixed */}
        <div className="flex items-center justify-between h-16">
          {/* Left side of header (e.g., search or page title - usually dynamic) */}
          <div className="flex items-center">
            <MobileMenuButton onOpenMobileMenu={onOpenMobileMenu} />
            {/* <h1 className="text-xl font-semibold text-slate-700">כותרת עמוד</h1> */}
          </div>

          {/* Right side - User info and Logout */}
          {user && (
            <div className="flex items-center space-x-3">
              <span className="text-slate-600 text-sm hidden sm:block">
                שלום, {user.name || user.email}
              </span>
              <button
                onClick={logout}
                title="התנתק"
                className="p-2 rounded-full text-slate-500 hover:text-red-600 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition duration-150 ease-in-out"
              >
                <FiLogOut className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;