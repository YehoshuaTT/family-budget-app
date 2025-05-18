// src/pages/UserSettingsPage.jsx
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/apiClient';
import { FiSave, FiAlertCircle, FiUser } from 'react-icons/fi'; // הוספנו אייקון משתמש
import { useAuth } from '../contexts/AuthContext'; // נייבא את AuthContext

// --- API Functions ---
const fetchUserData = async () => {
  // זה יכול להיות /api/auth/profile או /api/users/profile
  // תלוי איך הגדרת אותו ב-backend
  const { data } = await apiClient.get('/users/profile'); // נניח שהנתיב הזה מחזיר User (כולל שם)
  return data;
};

const updateUserName = async (userData) => {
  // userData יהיה אובייקט כמו { name: "New Name" }
  const { data } = await apiClient.put('/users/profile', userData);
  return data;
};

const fetchAppSettings = async () => {
  const { data } = await apiClient.get('/user-settings');
  return data;
};

const updateAppSettings = async (settingsData) => {
  const { data } = await apiClient.put('/user-settings', settingsData);
  return data;
};
// --------------------


function UserSettingsPage() {
  const queryClient = useQueryClient();
  const { user: authUser, fetchUserProfile: refreshAuthUser, token } = useAuth(); // קבל משתמש מה-AuthContext

  // Query for user data (name, email)
  const { data: userData, isLoading: isLoadingUser, error: userError } = useQuery({
    queryKey: ['userDataProfile'], // מפתח נפרד לפרופיל המשתמש
    queryFn: fetchUserData,
    enabled: !!token, // הפעל רק אם יש טוקן
  });

  // Query for app settings (monthlyBudgetGoal)
  const { data: appSettings, isLoading: isLoadingAppSettings, error: appSettingsError } = useQuery({
    queryKey: ['userAppSettings'], // מפתח נפרד להגדרות האפליקציה
    queryFn: fetchAppSettings,
    enabled: !!token,
  });

  const { 
    register, 
    handleSubmit, 
    setValue, 
    formState: { errors: formErrors, isDirty: formIsDirty, isSubmitting: formIsSubmitting } 
  } = useForm({
    defaultValues: {
      name: '',
      monthlyBudgetGoal: null,
    }
  });

  // State להודעות מהשרת
  const [serverMessage, setServerMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // 'success' or 'error'

  // Update form with fetched data
  useEffect(() => {
    if (userData) {
      setValue('name', userData.name || '', { shouldDirty: false });
    }
  }, [userData, setValue]);

  useEffect(() => {
    if (appSettings) {
      setValue('monthlyBudgetGoal', appSettings.monthlyBudgetGoal === null ? '' : appSettings.monthlyBudgetGoal, { shouldDirty: false });
    }
  }, [appSettings, setValue]);

  // Mutation for updating user name
  const userNameMutation = useMutation({
    mutationFn: updateUserName,
    onSuccess: (updatedUserData) => {
      queryClient.setQueryData(['userDataProfile'], updatedUserData); // עדכן את ה-cache של פרופיל המשתמש
      if (refreshAuthUser) {
        refreshAuthUser(token); // רענן את המשתמש ב-AuthContext
      }
      setMessageType('success');
      setServerMessage('שם המשתמש עודכן בהצלחה!');
    },
    onError: (error) => {
      console.error("Error updating user name:", error);
      setMessageType('error');
      setServerMessage(`שגיאה בעדכון שם המשתמש: ${error.response?.data?.message || error.message}`);
    }
  });

  // Mutation for updating app settings (budget goal)
  const appSettingsMutation = useMutation({
    mutationFn: updateAppSettings,
    onSuccess: (updatedAppSettingsData) => {
      queryClient.setQueryData(['userAppSettings'], updatedAppSettingsData);
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      setMessageType('success');
      setServerMessage('יעד התקציב עודכן בהצלחה!');
    },
    onError: (error) => {
      console.error("Error updating app settings:", error);
      setMessageType('error');
      setServerMessage(`שגיאה בעדכון יעד התקציב: ${error.response?.data?.message || error.message}`);
    }
  });

  const onSubmit = (data) => {
    setServerMessage(''); // נקה הודעות קודמות

    const profilePayload = {
      name: data.name,
    };
    
    const settingsPayload = {
      monthlyBudgetGoal: data.monthlyBudgetGoal === '' || data.monthlyBudgetGoal === null || isNaN(parseFloat(data.monthlyBudgetGoal))
                         ? null 
                         : parseFloat(data.monthlyBudgetGoal)
    };

    // בדוק איזה חלק מהטופס השתנה ושלח רק את ה-mutation הרלוונטי או שניהם
    // לצורך הפשטות כרגע, נניח שהמשתמש יכול לשנות את שניהם וללחוץ שמור פעם אחת,
    // או שנפריד לכפתורי שמירה נפרדים. כאן נבצע את שניהם אם הטופס 'dirty'.
    // גישה טובה יותר תהיה לבדוק איזה שדה השתנה ספציפית.

    let promises = [];
    // בדוק אם השם השתנה מהערך המקורי (אם יש userData)
    if (userData && data.name !== userData.name) {
        promises.push(userNameMutation.mutateAsync(profilePayload));
    }
    // בדוק אם יעד התקציב השתנה מהערך המקורי (אם יש appSettings)
    const originalBudgetGoal = appSettings?.monthlyBudgetGoal === null ? '' : appSettings?.monthlyBudgetGoal;
    const formBudgetGoal = data.monthlyBudgetGoal === '' || data.monthlyBudgetGoal === null ? '' : data.monthlyBudgetGoal;

    if (appSettings && String(formBudgetGoal) !== String(originalBudgetGoal)) { // השוואה כמחרוזות לטיפול ב-null/ריקים
        promises.push(appSettingsMutation.mutateAsync(settingsPayload));
    }
    
    if (promises.length > 0) {
        Promise.all(promises)
            .then(() => {
                // הודעת הצלחה כללית אם צריך, או שה-onSuccess של כל mutation יטפל
                if (promises.length === 1 && messageType !== 'error') {
                    // אם רק mutation אחד רץ והוא הצליח, ההודעה שלו כבר הוצגה
                } else if (promises.length > 1 && messageType !== 'error') {
                    setMessageType('success');
                    setServerMessage('ההגדרות נשמרו בהצלחה!');
                }
            })
            .catch(() => {
                // onError של ה-mutation אמור לטפל בהודעת שגיאה ספציפית
                if (messageType !== 'error') { // אם לא הוצגה הודעת שגיאה ספציפית
                    setMessageType('error');
                    setServerMessage('אירעה שגיאה בשמירת חלק מההגדרות.');
                }
            });
    } else if (formIsDirty) { // אם הטופס dirty אבל לא זיהינו שינוי ספציפי (פחות סביר עם הבדיקות למעלה)
        setMessageType('info');
        setServerMessage('לא זוהו שינויים לשמירה.');
    }
  };
  
  if (isLoadingUser || isLoadingAppSettings) return <div className="p-6 text-center text-slate-600">טוען הגדרות...</div>;
  
  // שגיאה כללית אם אחת מהקריאות נכשלה
  const overallError = userError || appSettingsError;
  if (overallError && (!userData || !appSettings)) return ( // הצג רק אם אין נתונים בכלל
    <div className="flex flex-col items-center text-red-600 p-4 bg-red-50 rounded-md">
        <FiAlertCircle className="h-8 w-8 mb-2"/>
        <p>שגיאה בטעינת ההגדרות: {overallError.message}</p>
    </div>
  );

  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-6">הגדרות</h1>
      <div className="bg-white shadow-xl rounded-xl p-6 md:p-8 max-w-lg mx-auto">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* User Profile Section */}
          <fieldset>
            <legend className="text-lg font-semibold text-sky-700 mb-3 border-b border-sky-200 pb-2">
              <FiUser className="inline mr-2 mb-1" />
              פרטי פרופיל
            </legend>
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
                  שם מלא
                </label>
                <input
                  type="text"
                  id="name"
                  {...register("name", {
                    required: "שם הוא שדה חובה",
                    minLength: { value: 2, message: "השם חייב להכיל לפחות 2 תווים" }
                  })}
                  className={`w-full p-2.5 border rounded-md shadow-sm ${formErrors.name ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:border-sky-500 focus:ring-sky-500'}`}
                  placeholder="השם שלך"
                />
                {formErrors.name && <p className="text-xs text-red-500 mt-1">{formErrors.name.message}</p>}
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                  כתובת אימייל
                </label>
                <input
                  type="email"
                  id="email"
                  value={authUser?.email || userData?.email || ''} // הצג מה-AuthContext או מהטעינה
                  readOnly
                  disabled
                  className="w-full p-2.5 border border-slate-300 rounded-md shadow-sm bg-slate-50 text-slate-500 cursor-not-allowed"
                />
                 <p className="text-xs text-slate-500 mt-1">שינוי כתובת אימייל אינו נתמך כרגע.</p>
              </div>
            </div>
          </fieldset>

          {/* Application Settings Section */}
          <fieldset>
            <legend className="text-lg font-semibold text-sky-700 mb-3 border-b border-sky-200 pb-2">
              הגדרות תקציב
            </legend>
            <div className="space-y-4">
              <div>
                <label htmlFor="monthlyBudgetGoal" className="block text-sm font-medium text-slate-700 mb-1">
                  יעד תקציב חודשי כולל (בש"ח)
                </label>
                <input
                  type="number"
                  id="monthlyBudgetGoal"
                  step="0.01"
                  {...register("monthlyBudgetGoal", {
                    validate: (value) => {
                        if (value === '' || value === null) return true;
                        const num = parseFloat(value);
                        return (!isNaN(num) && num >= 0) || "הסכום חייב להיות מספר אי-שלילי או ריק";
                    }
                  })}
                  className={`w-full p-2.5 border rounded-md shadow-sm ${formErrors.monthlyBudgetGoal ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:border-sky-500 focus:ring-sky-500'}`}
                  placeholder="הכנס סכום (למשל, 5000)"
                />
                {formErrors.monthlyBudgetGoal && <p className="text-xs text-red-500 mt-1">{formErrors.monthlyBudgetGoal.message}</p>}
                <p className="text-xs text-slate-500 mt-1">השאר ריק אם אין יעד תקציב כולל.</p>
              </div>
              {/* כאן אפשר להוסיף עוד הגדרות אפליקציה */}
            </div>
          </fieldset>
          
          {serverMessage && (
            <div className={`p-3 rounded-md text-sm ${messageType === 'success' ? 'bg-green-50 text-green-700' : messageType === 'error' ? 'bg-red-50 text-red-700' : 'bg-sky-50 text-sky-700'}`}>
              {serverMessage}
            </div>
          )}

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={!formIsDirty || userNameMutation.isLoading || appSettingsMutation.isLoading || formIsSubmitting}
              className="flex items-center px-6 py-2.5 bg-sky-600 text-white rounded-lg shadow-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
            >
              {userNameMutation.isLoading || appSettingsMutation.isLoading || formIsSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
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