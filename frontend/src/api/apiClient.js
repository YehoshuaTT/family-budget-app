// src/api/apiClient.js
import axios from 'axios';

// קבל את ה-URL של ה-Backend ממשתנה סביבה
// בפרויקט Vite, משתני סביבה שמתחילים ב- VITE_ חשופים לקוד הלקוח.
// בקובץ .env בתיקייה הראשית של הפרונטאנד: VITE_BACKEND_API_URL=http://localhost:3001/api
const baseURL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:3001/api';

const apiClient = axios.create({
  baseURL: baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor:
// מוסיף את ה-JWT token לכל בקשה יוצאת אם הוא קיים
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor (אופציונלי, אבל מאוד שימושי):
// מטפל בשגיאות גלובליות, למשל אם ה-token פג תוקף (401)
apiClient.interceptors.response.use(
  (response) => {
    // כל סטטוס קוד בטווח של 2xx יגרום לפונקציה הזו להיות מופעלת
    return response;
  },
  (error) => {
    // כל סטטוס קוד מחוץ לטווח של 2xx יגרום לפונקציה הזו להיות מופעלת
    if (error.response) {
      const { status, data } = error.response;
      
      if (status === 401) {
        // אם קיבלנו 401 (Unauthorized / Token Expired)
        // נקה את הטוקן והמשתמש המקומיים ובצע logout
        console.warn("Received 401 Unauthorized, logging out.");
        localStorage.removeItem('authToken');
        // כאן היית רוצה לקרוא לפונקציית logout מה-AuthContext,
        // אבל יש בעיית ייבוא מעגלי אם apiClient מייבא מ-AuthContext וההיפך.
        // פתרון נפוץ: שימוש באירוע custom, או העברת פונקציית logout ל-interceptor.
        // או, פשוט להפנות לדף ההתחברות.
        // window.location.href = '/login'; // הפניה "קשה" לדף ההתחברות
        
        // דרך טובה יותר היא שהקומפוננטות שמקבלות שגיאה 401 יקראו ל-logout מה-AuthContext.
        // או להשתמש במנגנון event bus.
        // למען הפשטות כרגע, נשאיר את זה כך, אבל זה נושא לשיפור.
      }
      
      // אפשר להוסיף כאן לוגיקה נוספת לטיפול בשגיאות אחרות (403, 404, 500)
      // ולהציג הודעות שגיאה גלובליות למשתמש אם רוצים.
      console.error("API Error:", status, data?.message || data);
    } else if (error.request) {
      // הבקשה נשלחה אבל לא התקבלה תגובה
      console.error("API No Response:", error.request);
    } else {
      // משהו קרה בהגדרת הבקשה שגרם לשגיאה
      console.error("API Request Setup Error:", error.message);
    }
    return Promise.reject(error); // חשוב להחזיר את השגיאה כדי שהקוד שקרא ל-API יוכל לתפוס אותה
  }
);

export default apiClient;