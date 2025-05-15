// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiClient from '../api/apiClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('authToken'));
  const [isLoading, setIsLoading] = useState(true); // Start as true

  const logout = useCallback(() => { // useCallback for logout as it's stable
    localStorage.removeItem('authToken');
    setToken(null);
    setUser(null);
    delete apiClient.defaults.headers.common['Authorization'];
    console.log("User logged out");
    // Optional: redirect to login page
    // navigate('/login'); // If you have access to navigate function
  }, []);

  const fetchUserProfile = useCallback(async (currentToken) => {
    if (!currentToken) {
      setUser(null); // Ensure user is null if no token
      setIsLoading(false);
      return;
    }
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${currentToken}`;
    try {
      // החלף את '/auth/profile' בנתיב הנכון אם הוא שונה
      const { data } = await apiClient.get('/auth/profile'); // This endpoint returns the user object
      setUser(data); // שמור את כל אובייקט המשתמש
      setToken(currentToken); // Ensure token in state is also set/confirmed
    } catch (error) {
      console.error("Token validation/profile fetch failed:", error.response?.data?.message || error.message);
      logout(); // Call logout to clear everything if token is invalid
    } finally {
      setIsLoading(false);
    }
  }, [logout]); // Add logout to dependency array of fetchUserProfile

  useEffect(() => {
    const currentToken = localStorage.getItem('authToken');
    if (currentToken) {
      fetchUserProfile(currentToken);
    } else {
      setIsLoading(false); // No token, so authentication check is done, not loading.
    }
  }, [fetchUserProfile]); // fetchUserProfile is stable due to useCallback

  const login = async (email, password) => {
    setIsLoading(true);
    try {
      const response = await apiClient.post('/auth/login', { email, password });
      // ודא שהשרת מחזיר אובייקט user מלא בנוסף לטוקן
      // למשל: { token: "...", user: { id: 1, email: "...", name: "..." } }
      const { token: newToken, user: userData } = response.data;

      if (!newToken || !userData) {
        throw new Error("Login response missing token or user data.");
      }

      localStorage.setItem('authToken', newToken);
      setToken(newToken);
      setUser(userData); // שמור את כל אובייקט המשתמש
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      setIsLoading(false);
      return { success: true, user: userData };
    } catch (error) {
      console.error("Login failed:", error.response?.data?.message || error.message);
      setIsLoading(false);
      // במקרה של שגיאת התחברות, נקה כל משתמש/טוקן קודם
      logout(); // Ensures clean state on login failure
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
    isAuthenticated: !isLoading && !!user, // User is authenticated if not loading and user object exists
    fetchUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined || context === null) { // Check for undefined or null
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};