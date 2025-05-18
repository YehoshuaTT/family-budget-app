// src/components/ui/Modal.jsx
import React, { useEffect } from 'react';
import { FiX } from 'react-icons/fi';

const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden'; // מנע גלילה של הרקע כשהמודל פתוח
      document.addEventListener('keydown', handleEscape);
    } else {
      document.body.style.overflow = 'unset'; // אפשר גלילה חזרה כשהמודל סגור
    }

    return () => {
      document.body.style.overflow = 'unset'; // נקה גם ב-unmount
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // אם isOpen הוא false, אל תרנדר כלום
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  };

  const modalSizeClass = sizeClasses[size] || sizeClasses.md;

  return (
    // Overlay
    <div
      className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4 z-[999] transition-opacity duration-300 ease-in-out" // הגדלתי קצת את ה-opacity וה-z-index
      onClick={onClose} // סגירה בלחיצה על הרקע
      role="dialog" // נגישות
      aria-modal="true" // נגישות
      aria-labelledby="modal-title" // נגישות - הכותרת של המודל
    >
      {/* Modal Content */}
      <div
        // הקלאסים הבאים קובעים את המצב ההתחלתי של האנימציה (לפני שהיא רצה)
        // והקלאס animate-modalShow מפעיל את האנימציה שהגדרת ב-CSS
        className={`bg-white rounded-xl shadow-2xl overflow-hidden w-full ${modalSizeClass} 
                    transform transition-all duration-300 ease-out 
                    ${isOpen ? 'scale-100 opacity-100 animate-modalShow' : 'scale-95 opacity-0'}`} // אנימציה מותנית
        onClick={(e) => e.stopPropagation()} // מניעת סגירה בלחיצה על תוכן המודל
        role="document" // נגישות
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200">
          <h3 className="text-lg sm:text-xl font-semibold text-slate-700" id="modal-title">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500"
            aria-label="סגור מודל"
          >
            <FiX className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 max-h-[70vh] overflow-y-auto"> {/* הגבלת גובה וגלילה לתוכן */}
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;