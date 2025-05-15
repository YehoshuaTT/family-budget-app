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
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity duration-300 ease-in-out rtl"
      onClick={onClose} // סגירה בלחיצה על הרקע
    >
      <div
        className={`bg-white rounded-xl shadow-2xl overflow-hidden w-full ${sizeClasses[size] || sizeClasses.md} transform transition-all duration-300 ease-in-out scale-95 opacity-0 animate-modalShow`}
        onClick={(e) => e.stopPropagation()} // מניעת סגירה בלחיצה על תוכן המודל
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h3 className="text-xl font-semibold text-slate-700">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            aria-label="סגור מודל"
          >
            <FiX className="h-6 w-6" />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
      {/* אנימציה למודל ב-CSS (אפשר להוסיף ל-index.css או tailwind.config.js) */}
     
    </div>
  );
};

export default Modal;