// src/pages/SignupPage.jsx
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { FiUser, FiMail, FiLock, FiCheckCircle, FiAlertCircle } from 'react-icons/fi'; // אייקונים

function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      setError("הסיסמה חייבת להכיל לפחות 6 תווים.");
      return;
    }
    if (password !== confirmPassword) {
      setError("הסיסמאות אינן תואמות");
      return;
    }
    setError('');
    setSuccess('');
    setLoading(true);

    const result = await signup(name, email, password);
    if (result.success) {
      setSuccess("ההרשמה בוצעה בהצלחה! כעת תוכל להתחבר.");
      setTimeout(() => navigate('/login'), 3000);
    } else {
      setError(result.message || 'ההרשמה נכשלה. נסה שנית.');
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-100 to-sky-100 p-4 rtl">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-2xl">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-700">יצירת חשבון חדש</h1>
          <p className="mt-2 text-slate-500">מלא את הפרטים והצטרף אלינו</p>
        </div>

        {error && (
          <div className="flex items-center p-3 text-sm text-red-700 bg-red-100 rounded-md border border-red-300">
            <FiAlertCircle className="w-5 h-5 mr-2" />
            {error}
          </div>
        )}
        {success && (
          <div className="flex items-center p-3 text-sm text-green-700 bg-green-100 rounded-md border border-green-300">
            <FiCheckCircle className="w-5 h-5 mr-2" />
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-600 mb-1">
              שם (אופציונלי)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <FiUser />
              </div>
              <input
                type="text"
                id="name"
                name="name"
                className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                placeholder="שם פרטי"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-600 mb-1">
              כתובת אימייל*
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <FiMail />
              </div>
              <input
                type="email"
                id="email"
                name="email"
                className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-600 mb-1">
              סיסמה* <span className="text-xs text-slate-500">(לפחות 6 תווים)</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <FiLock />
              </div>
              <input
                type="password"
                id="password"
                name="password"
                className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-600 mb-1">
              אימות סיסמה*
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <FiLock />
              </div>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-60 disabled:cursor-not-allowed transition duration-150 ease-in-out"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  יוצר חשבון...
                </>
              ) : (
                <>
                  <FiCheckCircle className="mr-2 h-5 w-5" /> הירשם
                </>
              )}
            </button>
          </div>
        </form>

        <p className="mt-8 text-center text-sm text-slate-500">
          יש לך כבר חשבון?{' '}
          <Link to="/login" className="font-medium text-sky-600 hover:text-sky-500 hover:underline">
            התחבר כאן
          </Link>
        </p>
      </div>
    </div>
  );
}

export default SignupPage;