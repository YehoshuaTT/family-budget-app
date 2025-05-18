// frontend/src/pages/ForgotPasswordPage.jsx
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import apiClient from '../api/apiClient';
import { Link } from 'react-router-dom';
import { FiMail, FiSend } from 'react-icons/fi';

function ForgotPasswordPage() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const onSubmit = async (data) => {
    setMessage('');
    setError('');
    try {
      const response = await apiClient.post('/auth/forgot-password', data);
      setMessage(response.data.message || 'Check your email for a password reset link.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send reset link. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 sm:p-10 rounded-xl shadow-xl">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900">
            שכחת את הסיסמה?
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600">
            הזן את כתובת האימייל שלך ונשלח לך קישור לאיפוס הסיסמה.
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          {message && <p className="text-sm text-green-600 bg-green-50 p-3 rounded-md">{message}</p>}
          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{error}</p>}
          
          <div>
            <label htmlFor="email-address" className="sr-only">כתובת אימייל</label>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiMail className="h-5 w-5 text-slate-400" aria-hidden="true" />
                </div>
                <input
                id="email-address"
                type="email"
                autoComplete="email"
                {...register("email", { required: "יש להזין כתובת אימייל" })}
                className={`appearance-none rounded-md relative block w-full px-3 py-3 pl-10 border ${errors.email ? 'border-red-500' : 'border-slate-300'} placeholder-slate-500 text-slate-900 focus:outline-none focus:ring-sky-500 focus:border-sky-500 focus:z-10 sm:text-sm`}
                placeholder="כתובת אימייל"
                />
            </div>
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50"
            >
              {isSubmitting ? 'שולח...' : <>שלח קישור לאיפוס <FiSend className="ml-2 h-5 w-5"/></>}
            </button>
          </div>
        </form>
        <div className="text-sm text-center">
          <Link to="/login" className="font-medium text-sky-600 hover:text-sky-800">
            חזרה להתחברות
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;