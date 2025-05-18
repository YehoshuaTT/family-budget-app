// frontend/src/pages/UserSettingsPage.jsx
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/apiClient';
import { FiSave, FiAlertCircle, FiUser, FiLock, FiDollarSign } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';

// --- API Functions (כפי שהיו, אולי נוסיף changePasswordMutationFn) ---
const fetchUserData = async () => {
  const { data } = await apiClient.get('/users/profile');
  return data;
};
const updateUserName = async (userData) => {
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
// --- פונקציה חדשה לעדכון סיסמה ---
const changePassword = async (passwordData) => {
    const { data } = await apiClient.post('/users/change-password', passwordData);
    return data;
};
// --------------------


function UserSettingsPage() {
  const queryClient = useQueryClient();
  const { user: authUser, fetchUserProfile: refreshAuthUser, token, logout } = useAuth(); // הוספתי logout

  const { data: userData, isLoading: isLoadingUser, error: userError } = useQuery({
    queryKey: ['userDataProfile'],
    queryFn: fetchUserData,
    enabled: !!token,
  });

  const { data: appSettings, isLoading: isLoadingAppSettings, error: appSettingsError } = useQuery({
    queryKey: ['userAppSettings'],
    queryFn: fetchAppSettings,
    enabled: !!token,
  });

  // טופס לפרטי פרופיל והגדרות אפליקציה
  const { 
    register: registerProfile, 
    handleSubmit: handleSubmitProfile, 
    setValue: setProfileValue, 
    formState: { errors: profileErrors, isDirty: profileIsDirty, isSubmitting: profileIsSubmitting },
    reset: resetProfileForm 
  } = useForm({
    defaultValues: { name: '', monthlyBudgetGoal: null }
  });

  // טופס לשינוי סיסמה
  const { 
    register: registerPassword, 
    handleSubmit: handleSubmitPassword, 
    formState: { errors: passwordErrors, isSubmitting: passwordIsSubmitting },
    watch: watchPassword, // כדי לבדוק התאמה
    reset: resetPasswordForm
  } = useForm({
    defaultValues: { currentPassword: '', newPassword: '', confirmNewPassword: '' }
  });

  const [profileServerMessage, setProfileServerMessage] = useState('');
  const [profileMessageType, setProfileMessageType] = useState('');
  const [passwordServerMessage, setPasswordServerMessage] = useState('');
  const [passwordMessageType, setPasswordMessageType] = useState('');


  useEffect(() => {
    if (userData) {
      setProfileValue('name', userData.name || '', { shouldDirty: false });
    }
  }, [userData, setProfileValue]);

  useEffect(() => {
    if (appSettings) {
      setProfileValue('monthlyBudgetGoal', appSettings.monthlyBudgetGoal === null ? '' : appSettings.monthlyBudgetGoal, { shouldDirty: false });
    }
  }, [appSettings, setProfileValue]);

  const userNameMutation = useMutation({
    mutationFn: updateUserName,
    onSuccess: (updatedUserData) => {
      queryClient.setQueryData(['userDataProfile'], updatedUserData);
      if (refreshAuthUser) refreshAuthUser(token);
      setProfileMessageType('success');
      setProfileServerMessage('שם המשתמש עודכן בהצלחה!');
    },
    onError: (error) => {
      console.error("Error updating user name:", error);
      setProfileMessageType('error');
      const apiError = error.response?.data?.errors?.[0]?.msg || error.response?.data?.message;
      setProfileServerMessage(`שגיאה בעדכון שם המשתמש: ${apiError || error.message}`);
    }
  });

  const appSettingsMutation = useMutation({
    mutationFn: updateAppSettings,
    onSuccess: (updatedAppSettingsData) => {
      queryClient.setQueryData(['userAppSettings'], updatedAppSettingsData);
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      setProfileMessageType('success');
      setProfileServerMessage('יעד התקציב עודכן בהצלחה!'); // אפשר לשלב הודעות
    },
    onError: (error) => {
      console.error("Error updating app settings:", error);
      setProfileMessageType('error');
      const apiError = error.response?.data?.errors?.[0]?.msg || error.response?.data?.message;
      setProfileServerMessage(`שגיאה בעדכון יעד התקציב: ${apiError || error.message}`);
    }
  });

  // Mutation לשינוי סיסמה
  const passwordChangeMutation = useMutation({
    mutationFn: changePassword,
    onSuccess: (data) => {
      setPasswordMessageType('success');
      setPasswordServerMessage(data.message || 'הסיסמה שונתה בהצלחה! מומלץ להתנתק ולהתחבר מחדש.');
      resetPasswordForm(); // אפס את טופס הסיסמה
      // שקול לבצע logout אוטומטי למשתמש כאן לשיפור אבטחה
      // logout();
      // navigate('/login');
    },
    onError: (error) => {
        console.error("Error changing password:", error);
        setPasswordMessageType('error');
        const apiError = error.response?.data?.errors?.[0]?.msg || error.response?.data?.message;
        setPasswordServerMessage(`שגיאה בשינוי הסיסמה: ${apiError || "אירעה שגיאה."}`);
    }
  });


  const onProfileSubmit = (data) => {
    setProfileServerMessage('');
    const profilePayload = { name: data.name };
    const settingsPayload = {
      monthlyBudgetGoal: data.monthlyBudgetGoal === '' || data.monthlyBudgetGoal === null || isNaN(parseFloat(data.monthlyBudgetGoal))
                         ? null 
                         : parseFloat(data.monthlyBudgetGoal)
    };

    let promises = [];
    if (userData && data.name !== userData.name) {
        promises.push(userNameMutation.mutateAsync(profilePayload));
    }
    const originalBudgetGoal = appSettings?.monthlyBudgetGoal === null ? '' : appSettings?.monthlyBudgetGoal;
    const formBudgetGoal = data.monthlyBudgetGoal === '' || data.monthlyBudgetGoal === null ? '' : data.monthlyBudgetGoal;

    if (appSettings && String(formBudgetGoal) !== String(originalBudgetGoal)) {
        promises.push(appSettingsMutation.mutateAsync(settingsPayload));
    }
    
    if (promises.length > 0) {
        Promise.all(promises)
            .then(() => {
                if (promises.length === 1 && profileMessageType !== 'error') {
                    // ההודעה כבר הוצגה מה-onSuccess של ה-mutation
                } else if (promises.length > 1 && profileMessageType !== 'error') {
                    setProfileMessageType('success');
                    setProfileServerMessage('ההגדרות נשמרו בהצלחה!');
                }
            })
            .catch(() => {
                if (profileMessageType !== 'error') {
                    setProfileMessageType('error');
                    setProfileServerMessage('אירעה שגיאה בשמירת חלק מההגדרות.');
                }
            });
    } else if (profileIsDirty) {
        setProfileMessageType('info');
        setProfileServerMessage('לא זוהו שינויים לשמירה.');
    }
  };

  const onChangePasswordSubmit = (data) => {
    setPasswordServerMessage(''); // נקה הודעות קודמות
    passwordChangeMutation.mutate(data);
  };
  
  // ... (isLoading, error handling כמו קודם) ...
  if (isLoadingUser || isLoadingAppSettings) return <div className="p-6 text-center text-slate-600">טוען הגדרות...</div>;
  const overallError = userError || appSettingsError;
  if (overallError && (!userData || !appSettings)) return (
    <div className="flex flex-col items-center text-red-600 p-4 bg-red-50 rounded-md">
        <FiAlertCircle className="h-8 w-8 mb-2"/>
        <p>שגיאה בטעינת ההגדרות: {overallError.message}</p>
    </div>
  );

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto" dir="rtl"> {/* הגדלתי את הרוחב המקסימלי */}
      <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-8">הגדרות</h1>
      
      {/* Form for Profile and App Settings */}
      <div className="bg-white shadow-xl rounded-xl p-6 md:p-8 mb-10">
        <form onSubmit={handleSubmitProfile(onProfileSubmit)} className="space-y-8">
          <fieldset>
            <legend className="text-lg font-semibold text-sky-700 mb-3 border-b border-sky-200 pb-2 flex items-center">
              <FiUser className="ml-2 text-xl" /> פרטי פרופיל
            </legend>
            {/* ... (שדות שם ואימייל כמו קודם) ... */}
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">שם מלא</label>
                <input type="text" id="name" {...registerProfile("name", { required: "שם הוא שדה חובה", minLength: { value: 2, message: "השם חייב להכיל לפחות 2 תווים" } })}
                  className={`w-full p-2.5 border rounded-md shadow-sm ${profileErrors.name ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:border-sky-500 focus:ring-sky-500'}`} placeholder="השם שלך"/>
                {profileErrors.name && <p className="text-xs text-red-500 mt-1">{profileErrors.name.message}</p>}
              </div>
              <div>
                <label htmlFor="email_display" className="block text-sm font-medium text-slate-700 mb-1">כתובת אימייל</label>
                <input type="email" id="email_display" value={authUser?.email || userData?.email || ''} readOnly disabled
                  className="w-full p-2.5 border border-slate-300 rounded-md shadow-sm bg-slate-50 text-slate-500 cursor-not-allowed"/>
                 <p className="text-xs text-slate-500 mt-1">שינוי כתובת אימייל אינו נתמך כרגע.</p>
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-lg font-semibold text-sky-700 mb-3 border-b border-sky-200 pb-2 flex items-center">
              <FiDollarSign className="ml-2 text-xl" /> הגדרות תקציב
            </legend>
            {/* ... (שדה יעד תקציב חודשי כמו קודם) ... */}
            <div className="space-y-4">
              <div>
                <label htmlFor="monthlyBudgetGoal" className="block text-sm font-medium text-slate-700 mb-1">יעד תקציב חודשי כולל (בש"ח)</label>
                <input type="number" id="monthlyBudgetGoal" step="0.01" {...registerProfile("monthlyBudgetGoal", { validate: (value) => { if (value === '' || value === null) return true; const num = parseFloat(value); return (!isNaN(num) && num >= 0) || "הסכום חייב להיות מספר אי-שלילי או ריק"; }})}
                  className={`w-full p-2.5 border rounded-md shadow-sm ${profileErrors.monthlyBudgetGoal ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:border-sky-500 focus:ring-sky-500'}`} placeholder="הכנס סכום (למשל, 5000)"/>
                {profileErrors.monthlyBudgetGoal && <p className="text-xs text-red-500 mt-1">{profileErrors.monthlyBudgetGoal.message}</p>}
                <p className="text-xs text-slate-500 mt-1">השאר ריק אם אין יעד תקציב כולל.</p>
              </div>
            </div>
          </fieldset>
          
          {profileServerMessage && (
            <div className={`p-3 rounded-md text-sm ${profileMessageType === 'success' ? 'bg-green-50 text-green-700' : profileMessageType === 'error' ? 'bg-red-50 text-red-700' : 'bg-sky-50 text-sky-700'}`}>
              {profileServerMessage}
            </div>
          )}

          <div className="flex justify-end pt-4">
            <button type="submit" disabled={!profileIsDirty || userNameMutation.isLoading || appSettingsMutation.isLoading || profileIsSubmitting}
              className="flex items-center px-6 py-2.5 bg-sky-600 text-white rounded-lg shadow-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150">
              {userNameMutation.isLoading || appSettingsMutation.isLoading || profileIsSubmitting ? (<><svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" viewBox="0 0 24 24">...</svg>שומר...</>) : (<><FiSave className="ml-2 h-5 w-5" /> שמור הגדרות פרופיל ותקציב</>)}
            </button>
          </div>
        </form>
      </div>

      {/* Form for Changing Password */}
      <div className="bg-white shadow-xl rounded-xl p-6 md:p-8 mt-10">
        <form onSubmit={handleSubmitPassword(onChangePasswordSubmit)} className="space-y-6">
            <fieldset>
                <legend className="text-lg font-semibold text-red-700 mb-3 border-b border-red-200 pb-2 flex items-center">
                    <FiLock className="ml-2 text-xl" /> שינוי סיסמה
                </legend>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="currentPassword_settings" className="block text-sm font-medium text-slate-700 mb-1">סיסמה נוכחית*</label>
                        <input type="password" id="currentPassword_settings" {...registerPassword("currentPassword", { required: "סיסמה נוכחית היא שדה חובה" })}
                            className={`w-full p-2.5 border rounded-md shadow-sm ${passwordErrors.currentPassword ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:border-sky-500 focus:ring-sky-500'}`} />
                        {passwordErrors.currentPassword && <p className="text-xs text-red-500 mt-1">{passwordErrors.currentPassword.message}</p>}
                    </div>
                    <div>
                        <label htmlFor="newPassword_settings" className="block text-sm font-medium text-slate-700 mb-1">סיסמה חדשה*</label>
                        <input type="password" id="newPassword_settings" {...registerPassword("newPassword", { required: "סיסמה חדשה היא שדה חובה", minLength: { value: 8, message: "הסיסמה חייבת להכיל לפחות 8 תווים" } })}
                            className={`w-full p-2.5 border rounded-md shadow-sm ${passwordErrors.newPassword ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:border-sky-500 focus:ring-sky-500'}`} />
                        {passwordErrors.newPassword && <p className="text-xs text-red-500 mt-1">{passwordErrors.newPassword.message}</p>}
                    </div>
                    <div>
                        <label htmlFor="confirmNewPassword_settings" className="block text-sm font-medium text-slate-700 mb-1">אשר סיסמה חדשה*</label>
                        <input type="password" id="confirmNewPassword_settings" {...registerPassword("confirmNewPassword", { required: "אישור סיסמה הוא שדה חובה", validate: value => value === watchPassword("newPassword") || "הסיסמאות אינן תואמות" })}
                            className={`w-full p-2.5 border rounded-md shadow-sm ${passwordErrors.confirmNewPassword ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:border-sky-500 focus:ring-sky-500'}`} />
                        {passwordErrors.confirmNewPassword && <p className="text-xs text-red-500 mt-1">{passwordErrors.confirmNewPassword.message}</p>}
                    </div>
                </div>
            </fieldset>
            
            {passwordServerMessage && (
                <div className={`p-3 rounded-md text-sm ${passwordMessageType === 'success' ? 'bg-green-50 text-green-700' : passwordMessageType === 'error' ? 'bg-red-50 text-red-700' : 'bg-sky-50 text-sky-700'}`}>
                {passwordServerMessage}
                </div>
            )}

            <div className="flex justify-end pt-4">
                <button type="submit" disabled={passwordChangeMutation.isLoading || passwordIsSubmitting}
                className="flex items-center px-6 py-2.5 bg-red-600 text-white rounded-lg shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150">
                {passwordChangeMutation.isLoading || passwordIsSubmitting ? (<><svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" viewBox="0 0 24 24">...</svg>משנה סיסמה...</>) : (<><FiLock className="ml-2 h-5 w-5" /> שנה סיסמה</>)}
                </button>
            </div>
        </form>
      </div>
    </div>
  );
}

export default UserSettingsPage;