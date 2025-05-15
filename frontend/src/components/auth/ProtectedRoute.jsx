// src/components/auth/ProtectedRoute.jsx
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const ProtectedRoute = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    // בזמן שבדיקת האימות הראשונית מתבצעת, אפשר להציג מחוון טעינה
    // או כלום (כדי למנוע "קפיצה" בממשק)
    return <div className="flex justify-center items-center min-h-screen">טוען אימות...</div>;
  }

  if (!isAuthenticated) {
    // אם המשתמש לא מאומת והבדיקה הסתיימה, הפנה לדף ההתחברות
    return <Navigate to="/login" replace />;
  }

  // אם המשתמש מאומת, רנדר את התוכן של ה-Route המוגן
  return <Outlet />;
};

export default ProtectedRoute;