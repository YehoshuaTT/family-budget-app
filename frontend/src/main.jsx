// src/main.jsx (או .tsx)
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { AuthProvider } from './contexts/AuthContext';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'; // ודא שזה מיובא
// import { ReactQueryDevtools } from '@tanstack/react-query-devtools'; // אופציונלי, לכלי פיתוח

// צור מופע של QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 דקות (נתונים ייחשבו "טריים" ל-5 דקות)
      refetchOnWindowFocus: false, // אופציונלי: למנוע רענון אוטומטי כשהחלון מקבל פוקוס
      retry: 1, // נסה שוב פעם אחת במקרה של שגיאה
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}> {/* עוטף ב-Provider של React Query */}
        <AuthProvider>
          <App />
        </AuthProvider>
        {/* <ReactQueryDevtools initialIsOpen={false} /> // אופציונלי: כלי פיתוח שימושיים */}
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
);