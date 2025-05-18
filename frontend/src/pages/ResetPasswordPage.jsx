// frontend/src/pages/ResetPasswordPage.jsx
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useParams, useNavigate, Link } from 'react-router-dom';
import apiClient from '../api/apiClient';
import { FiLock, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';

function ResetPasswordPage() {
  const { token } = useParams(); // קבלת הטוקן מה-URL
  const navigate = useNavigate();
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const newPassword = watch("password");

  const onSubmit = async (data) => {
    setMessage('');
    setError('');
    if (!token) {
      setError("Token is missing. Cannot reset password.");
      return;
    }
    try {
      const response = await apiClient.post(`/auth/reset-password/${token}`, { 
        password: data.password,
        confirmPassword: data.confirmPassword 
      });
      setMessage(response.data.message || 'Password reset successfully! You can now log in.');
      setTimeout(() => navigate('/login'), 3000); // הפניה אוטומטית אחרי 3 שניות
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password. The link may be invalid or expired.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 sm:p-10 rounded-xl shadow-xl">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900">
            איפוס סיסמה
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          {message && 
            <div className="flex items-center p-4 mb-4 text-sm text-green-700 bg-green-100 rounded-lg" role="alert">
              <FiCheckCircle className="w-5 h-5 mr-2"/>
              <span>{message}</span>
            </div>
          }
          {error && 
            <div className="flex items-center p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg" role="alert">
              <FiAlertCircle className="w-5 h-5 mr-2"/>
              <span>{error}</span>
            </div>
          }
          
          {!message && ( // הצג את הטופס רק אם אין הודעת הצלחה
            <>
              <div>
                <label htmlFor="password_reset" className="sr-only">סיסמה חדשה</label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiLock className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                    id="password_reset"
                    type="password"
                    autoComplete="new-password"
                    {...register("password", { 
                        required: "יש להזין סיסמה חדשה",
                        minLength: { value: 8, message: "הסיסמה חייבת להכיל לפחות 8 תווים" }
                    })}
                    className={`appearance-none rounded-md relative block w-full px-3 py-3 pl-10 border ${errors.password ? 'border-red-500' : 'border-slate-300'} placeholder-slate-500 text-slate-900 focus:outline-none focus:ring-sky-500 focus:border-sky-500 focus:z-10 sm:text-sm`}
                    placeholder="סיסמה חדשה"
                    />
                </div>
                {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
              </div>

              <div>
                <label htmlFor="confirmPassword_reset" className="sr-only">אישור סיסמה חדשה</label>
                 <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiLock className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                    id="confirmPassword_reset"
                    type="password"
                    autoComplete="new-password"
                    {...register("confirmPassword", {
                        required: "יש לאשר את הסיסמה החדשה",
                        validate: value => value === newPassword || "הסיסמאות אינן תואמות"
                    })}
                    className={`appearance-none rounded-md relative block w-full px-3 py-3 pl-10 border ${errors.confirmPassword ? 'border-red-500' : 'border-slate-300'} placeholder-slate-500 text-slate-900 focus:outline-none focus:ring-sky-500 focus:border-sky-500 focus:z-10 sm:text-sm`}
                    placeholder="אישור סיסמה חדשה"
                    />
                </div>
                {errors.confirmPassword && <p className="text-xs text-red-500 mt-1">{errors.confirmPassword.message}</p>}
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50"
                >
                  {isSubmitting ? 'מאפס סיסמה...' : 'אפס סיסמה'}
                </button>
              </div>
            </>
          )}
        </form>
         {message && (
            <div className="text-sm text-center">
            <Link to="/login" className="font-medium text-sky-600 hover:text-sky-800">
                המשך להתחברות
            </Link>
            </div>
        )}
      </div>
    </div>
  );
}

export default ResetPasswordPage;