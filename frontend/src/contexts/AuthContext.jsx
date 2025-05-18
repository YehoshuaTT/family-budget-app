// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiClient from '../api/apiClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('authToken'));
  const [isLoading, setIsLoading] = useState(true); // Start as true

  const logout = useCallback(() => {
    localStorage.removeItem('authToken');
    setToken(null);
    setUser(null);
    delete apiClient.defaults.headers.common['Authorization'];
    console.log("User logged out");
  }, []);

  const fetchUserProfile = useCallback(async (currentToken) => {
    if (!currentToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true); // <--- שינוי חשוב: הגדר isLoading ל-true כאן
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${currentToken}`;
    try {
      const { data } = await apiClient.get('/auth/profile');
      setUser(data);
      setToken(currentToken);
    } catch (error) {
      console.error("Token validation/profile fetch failed:", error.response?.data?.message || error.message);
      logout();
    } finally {
      setIsLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    const currentToken = localStorage.getItem('authToken');
    if (currentToken) {
      fetchUserProfile(currentToken);
    } else {
      setIsLoading(false);
    }
  }, [fetchUserProfile]);

  const login = async (email, password) => {
    setIsLoading(true);
    try {
      const response = await apiClient.post('/auth/login', { email, password });
      const { token: newToken, user: userData } = response.data;

      if (!newToken || !userData) {
        throw new Error("Login response missing token or user data.");
      }

      localStorage.setItem('authToken', newToken);
      setToken(newToken);
      setUser(userData);
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      setIsLoading(false);
      return { success: true, user: userData };
    } catch (error) {
      console.error("Login failed:", error.response?.data?.message || error.message);
      setIsLoading(false);
      logout();
      return { success: false, message: error.response?.data?.message || "Login failed" };
    }
  };

  const signup = async (name, email, password) => {
    setIsLoading(true);
    try {
      const response = await apiClient.post('/auth/signup', { name, email, password });
      setIsLoading(false);
      return { success: true, data: response.data };
    } catch (error) {
      console.error("Signup failed:", error.response?.data?.message || error.message);
      setIsLoading(false);
      return { success: false, message: error.response?.data?.message || "Signup failed" };
    }
  };

  const value = {
    user,
    token,
    isLoading,
    login,
    signup,
    logout,
    isAuthenticated: !isLoading && !!user,
    fetchUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined || context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};