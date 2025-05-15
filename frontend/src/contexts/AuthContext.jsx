// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import apiClient from '../api/apiClient'; // נייבא את מופע ה-Axios שנגדיר בהמשך

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // יכול להכיל אובייקט משתמש, או null
  const [token, setToken] = useState(localStorage.getItem('authToken')); // טען טוקן מ-localStorage
  const [isLoading, setIsLoading] = useState(true); // מצב טעינה ראשוני לבדיקת טוקן

  // אפקט לבדיקת טוקן קיים בעת טעינת האפליקציה
  useEffect(() => {
    const verifyToken = async () => {
      if (token) {
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        try {
          // כאן כדאי להוסיף קריאת API ל-endpoint שמאמת את הטוקן ומחזיר פרטי משתמש
          // למשל, GET /api/auth/me או /api/users/me
          // לצורך הדוגמה, נניח שיש לנו פונקציה fetchUserProfile שתעשה זאת.
          // אם אין לך endpoint כזה כרגע, אפשר להשאיר את החלק הזה ריק
          // ולהסתמך רק על קיום הטוקן, או לפענח את הטוקן בצד הלקוח (פחות מאובטח למידע רגיש).

          // לדוגמה, אם יש לך endpoint כזה:
          // const { data } = await apiClient.get('/auth/me'); // החלף בנתיב הנכון
          // setUser(data.user); // נניח שהתשובה היא { user: { id, email, name } }

          // בינתיים, אם יש טוקן, נניח שהוא תקין לצורך ה-POC הראשוני
          // ונפענח את ה-userId מהטוקן אם הוא פשוט מספיק
          // אזהרה: פיענוח JWT בצד הלקוח אינו מאובטח לאימות, רק לקריאת נתונים לא רגישים
          // אימות אמיתי חייב לקרות מול השרת.
          try {
            const payloadBase64 = token.split('.')[1];
            const decodedPayload = JSON.parse(atob(payloadBase64));
            if (decodedPayload.userId) {
              setUser({ id: decodedPayload.userId }); // שמור רק את ה-ID לצורך הדוגמה
            }
          } catch (e) {
            console.error("Could not decode token locally for initial user info:", e);
            // אם הפיענוח נכשל, נתייחס לטוקן כלא תקין וננקה
            logout(); // ינקה את הטוקן ויאפס את המשתמש
          }

        } catch (error) {
          console.error("Token validation failed or no validation endpoint:", error);
          localStorage.removeItem('authToken');
          setToken(null);
          setUser(null);
          delete apiClient.defaults.headers.common['Authorization'];
        }
      }
      setIsLoading(false);
    };
    verifyToken();
  }, [token]); // רץ רק כשהטוקן משתנה

  const login = async (email, password) => {
    try {
      const response = await apiClient.post('/auth/login', { email, password });
      const { token: newToken, userId, name } = response.data; // נניח שהשרת מחזיר userId ו-name

      localStorage.setItem('authToken', newToken);
      setToken(newToken);
      setUser({ id: userId, email, name }); // שמור פרטי משתמש ב-state
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      return { success: true };
    } catch (error) {
      console.error("Login failed:", error.response?.data?.message || error.message);
      return { success: false, message: error.response?.data?.message || "Login failed" };
    }
  };

  const signup = async (name, email, password) => {
    try {
      await apiClient.post('/auth/signup', { name, email, password });
      // אפשר לבצע התחברות אוטומטית אחרי הרשמה, או לדרוש מהמשתמש להתחבר בנפרד
      return { success: true };
    } catch (error) {
      console.error("Signup failed:", error.response?.data?.message || error.message);
      return { success: false, message: error.response?.data?.message || "Signup failed" };
    }
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    setToken(null);
    setUser(null);
    delete apiClient.defaults.headers.common['Authorization'];
    // אפשר להוסיף ניווט לדף הבית/התחברות כאן אם רוצים
  };

  const value = {
    user,
    token,
    isLoading, // חשוף את מצב הטעינה
    login,
    signup,
    logout,
    isAuthenticated: !!token && !!user, // דרך פשוטה לבדוק אם מאומת
  };

  // אל תרנדר את הילדים עד שבדיקת הטוקן הראשונית הסתיימה
  // if (isLoading) {
  //   return <div>Loading authentication...</div>; // או קומפוננטת טעינה יפה יותר
  // }
  // ההערה הזו נכונה, אבל לפעמים רוצים לרנדר את האפליקציה ולהראות שלד גם אם הטעינה עדיין מתבצעת,
  // והקומפוננטות הפנימיות יטפלו בהצגת תוכן מותנה.
  // ההחלטה תלויה בחווית המשתמש הרצויה.

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};