    // src/pages/UserSettingsPage.jsx
import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/apiClient';
import { FiSave, FiAlertCircle } from 'react-icons/fi';

const fetchUserSettings = async () => {
  const { data } = await apiClient.get('/user-settings');
  return data;
};

const updateUserSettings = async (settingsData) => {
  const { data } = await apiClient.put('/user-settings', settingsData);
  return data;
};

function UserSettingsPage() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading, error } = useQuery({
    queryKey: ['userSettings'],
    queryFn: fetchUserSettings,
  });

  const { register, handleSubmit, setValue, formState: { errors, isDirty, isSubmitting } } = useForm({
    defaultValues: {
      monthlyBudgetGoal: null, // או 0 אם מעדיפים
      defaultCurrency: 'ILS' // יכול להיות גם נטען מה-API
    }
  });

  useEffect(() => {
    if (settings) {
      setValue('monthlyBudgetGoal', settings.monthlyBudgetGoal === null ? '' : settings.monthlyBudgetGoal); // הצג כשדה ריק אם null
      setValue('defaultCurrency', settings.defaultCurrency);
    }
  }, [settings, setValue]);

  const mutation = useMutation({
    mutationFn: updateUserSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(['userSettings'], data); // עדכן את ה-cache של React Query
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] }); // רענן את הדשבורד
      alert('ההגדרות נשמרו בהצלחה!');
    },
    onError: (error) => {
      console.error("Error updating settings:", error);
      alert(`שגיאה בשמירת ההגדרות: ${error.response?.data?.message || error.message}`);
    }
  });

  const onSubmit = (data) => {
    const payload = {
        // defaultCurrency: data.defaultCurrency, // אם מאפשרים שינוי
        monthlyBudgetGoal: data.monthlyBudgetGoal === '' || data.monthlyBudgetGoal === null || isNaN(parseFloat(data.monthlyBudgetGoal))
                           ? null 
                           : parseFloat(data.monthlyBudgetGoal)
    };
    mutation.mutate(payload);
  };
  
  if (isLoading) return <div className="p-6 text-center text-slate-600">טוען הגדרות...</div>;
  if (error) return (
    <div className="flex flex-col items-center text-red-600 p-4 bg-red-50 rounded-md">
        <FiAlertCircle className="h-8 w-8 mb-2"/>
        <p>שגיאה בטעינת ההגדרות: {error.message}</p>
    </div>
  );

  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-6">הגדרות משתמש</h1>
      <div className="bg-white shadow-xl rounded-xl p-6 md:p-8 max-w-lg mx-auto">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label htmlFor="defaultCurrency" className="block text-sm font-medium text-slate-700 mb-1">
              מטבע ברירת מחדל
            </label>
            <input
              type="text"
              id="defaultCurrency"
              {...register("defaultCurrency")}
              className="w-full p-2.5 border border-slate-300 rounded-md shadow-sm bg-slate-50 text-slate-500 cursor-not-allowed"
              readOnly 
              disabled
            />
            <p className="text-xs text-slate-500 mt-1">שינוי מטבע אינו נתמך כרגע.</p>
          </div>

          <div>
            <label htmlFor="monthlyBudgetGoal" className="block text-sm font-medium text-slate-700 mb-1">
              יעד תקציב חודשי כולל (₪)
            </label>
            <input
              type="number"
              id="monthlyBudgetGoal"
              step="0.01"
              {...register("monthlyBudgetGoal", {
                valueAsNumber: false, // קרא כמחרוזת ואז נטפל בהמרה ידנית
                validate: (value) => {
                    if (value === '' || value === null) return true; // Allow empty or null to clear
                    const num = parseFloat(value);
                    return (!isNaN(num) && num >= 0) || "הסכום חייב להיות מספר אי-שלילי או ריק";
                }
              })}
              className={`w-full p-2.5 border rounded-md shadow-sm ${errors.monthlyBudgetGoal ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:border-sky-500 focus:ring-sky-500'}`}
              placeholder="הכנס סכום (למשל, 5000)"
            />
            {errors.monthlyBudgetGoal && <p className="text-xs text-red-500 mt-1">{errors.monthlyBudgetGoal.message}</p>}
             <p className="text-xs text-slate-500 mt-1">השאר ריק או 0 אם אין יעד תקציב כולל.</p>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={!isDirty || mutation.isLoading || isSubmitting}
              className="flex items-center px-6 py-2.5 bg-sky-600 text-white rounded-lg shadow hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {mutation.isLoading || isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" /* ... spinner svg ... */></svg>
                  שומר...
                </>
              ) : (
                <><FiSave className="mr-2 h-5 w-5" /> שמור שינויים</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default UserSettingsPage;