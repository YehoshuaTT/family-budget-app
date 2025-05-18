// src/App.jsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import MainLayout from './components/layout/MainLayout'; 
import { useAuth } from './contexts/AuthContext';
import TransactionsListPage from './pages/TransactionsListPage'; 
import UserSettingsPage from './pages/UserSettingsPage'; 
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';

function App() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading && !sessionStorage.getItem('authLoadedOnce')) {
    return <div className="flex justify-center items-center min-h-screen text-xl">טוען אפליקציה...</div>;
  }
  if (!isLoading) {
      sessionStorage.setItem('authLoadedOnce', 'true');
  }


  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <LoginPage />} />
      <Route path="/signup" element={isAuthenticated ? <Navigate to="/" /> : <SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

      {/* Protected Routes use MainLayout */}
      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}> {/* עוטף את כל הדפים המוגנים ב-MainLayout */}
          <Route path="/settings" element={<UserSettingsPage />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} /> {/* הפניה מהשורש לדשבורד */}
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/transactions" element={<TransactionsListPage />} /> {/* דף חדש */}
          {/* <Route path="/budgets" element={<BudgetPage />} /> */}
          {/* <Route path="/settings" element={<SettingsPage />} /> */}
        </Route>
      </Route>

      {/* Fallback for any other route */}
      <Route
        path="*"
        element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
        }
      />
    </Routes>
  );
}

export default App;