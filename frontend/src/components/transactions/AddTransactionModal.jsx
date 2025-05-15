// src/components/transactions/AddTransactionModal.jsx
import React, { useState, useEffect, useCallback } from 'react';
import Modal from '../ui/Modal';
import { useForm } from 'react-hook-form';
import apiClient from '../../api/apiClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FiSave, FiXCircle } from 'react-icons/fi';
import { format, parseISO, isValid } from 'date-fns'; // Added isValid

const fetchCategories = async (type) => {
  const { data } = await apiClient.get(`/categories?type=${type}`);
  return data;
};

// הוספנו transactionToEdit כ-prop
const AddTransactionModal = ({ isOpen, onClose, initialType = 'expense', transactionToEdit = null }) => {
  const queryClient = useQueryClient();
  const [transactionType, setTransactionType] = useState(initialType);
  const [formError, setFormError] = useState('');
  const isEditMode = !!transactionToEdit;

  const defaultFormValues = {
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    description: '',
    subcategoryId: '',
    categoryId: '',
    paymentMethod: '',
    expenseTypeOption: 'single',
    frequency: 'monthly',
    interval: 1,
    occurrences: '',
    endDate: '',
    totalAmount: '',
    numberOfInstallments: '',
  };
  
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting }, setValue, clearErrors } = useForm({
    defaultValues: defaultFormValues
  });

  // אפקט לאכלוס הטופס אם אנחנו במצב עריכה
  useEffect(() => {
    if (isEditMode && transactionToEdit) {
      setTransactionType(transactionToEdit.type || transactionToEdit.transactionType || 'expense'); // type from list, transactionType from GET /:id
      
      const subId = transactionToEdit.subcategory?.id || transactionToEdit.subcategoryId;
      const catId = transactionToEdit.category?.id || transactionToEdit.categoryId;

      const valuesToSet = {
        amount: transactionToEdit.amount,
        date: transactionToEdit.date ? format(parseISO(transactionToEdit.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        description: transactionToEdit.description || '',
        subcategoryId: transactionToEdit.type === 'expense' || transactionToEdit.transactionType === 'expense' ? subId : '',
        categoryId: transactionToEdit.type === 'income' || transactionToEdit.transactionType === 'income' ? catId : '',
        paymentMethod: transactionToEdit.paymentMethod || '',
        expenseTypeOption: transactionToEdit.expenseType || 'single', // This might need mapping if API returns different values
        // TODO: Populate recurring/installment fields if editing these types (more complex)
        // For POC, editing might be limited to single transactions or basic fields of instances
      };
      
      // Set values for react-hook-form
      for (const [key, value] of Object.entries(valuesToSet)) {
        setValue(key, value, { shouldValidate: true, shouldDirty: true });
      }
      // If editing recurring or installment, fetch their definition and populate those fields too
      // This is more complex and might be out of scope for initial CRUD on instances.

    } else {
      // If not edit mode, or transactionToEdit becomes null, reset to defaults
      reset(defaultFormValues);
      setValue("date", format(new Date(), "yyyy-MM-dd")); // Ensure date is reset correctly
      setTransactionType(initialType); // Reset transactionType as well
    }
  }, [transactionToEdit, isEditMode, reset, setValue, initialType]);


  const watchedExpenseTypeOption = watch("expenseTypeOption");

  const { data: categories, isLoading: isLoadingCategories } = useQuery({
    queryKey: ['categories', transactionType],
    queryFn: () => fetchCategories(transactionType),
    enabled: isOpen,
  });

  const mutation = useMutation({
    mutationFn: (transactionData) => {
      const endpointType = transactionType === 'expense' ? 'expenses' : 'incomes';
      if (isEditMode) {
        return apiClient.put(`/${endpointType}/${transactionToEdit.id}`, transactionData.payload);
      }
      return apiClient.post(`/${endpointType}`, transactionData.payload);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      queryClient.invalidateQueries({ queryKey: ['recentTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['expenseDistribution'] });
      console.log(`${transactionType} ${isEditMode ? 'updated' : 'added'} successfully!`);
      onCloseAndReset();
    },
    onError: (error) => {
      console.error(`Error ${isEditMode ? 'updating' : 'adding'} ${transactionType}:`, error);
      setFormError(error.response?.data?.message || `Failed to ${isEditMode ? 'update' : 'add'} ${transactionType}.`);
    }
  });

  const onSubmit = (data) => {
    setFormError('');
    let payload = { // Renamed to let for modification
      amount: parseFloat(data.amount),
      date: data.date,
      description: data.description,
    };

    if (transactionType === 'expense') {
      payload.subcategoryId = parseInt(data.subcategoryId, 10);
      payload.paymentMethod = data.paymentMethod;
      
      // For POC, let's assume if editing, we don't change expenseType or recurring/installment details via this modal.
      // Those would be handled by dedicated edit forms for definitions.
      // If it's a new expense, we include type and definition details.
      if (!isEditMode) {
        payload.expenseType = data.expenseTypeOption;
        if (data.expenseTypeOption === 'recurring') {
          payload.frequency = data.frequency;
          payload.interval = data.interval ? parseInt(data.interval,10) : 1;
          if(data.occurrences) payload.occurrences = parseInt(data.occurrences,10);
          if(data.endDate && isValid(parseISO(data.endDate))) payload.endDate = format(parseISO(data.endDate), 'yyyy-MM-dd');
        } else if (data.expenseTypeOption === 'installment') {
          payload.totalAmount = parseFloat(data.totalAmount);
          payload.numberOfInstallments = parseInt(data.numberOfInstallments,10);
        }
      } else {
        // If editing, we might only send fields that are allowed to be changed for an *instance*
        // For a 'single' expense, all these fields are fine.
        // For 'recurring_instance' or 'installment_instance', we might only allow editing:
        // amount (if the actual amount differed), date (if paid early/late), description, isProcessed.
        // The backend PUT /api/expenses/:id handler also needs to respect these limitations.
        // The current backend PUT allows these.
         payload.isProcessed = data.isProcessed !== undefined ? data.isProcessed : transactionToEdit?.isProcessed;
      }

    } else { // Income
      payload.categoryId = data.categoryId ? parseInt(data.categoryId, 10) : null;
    }
    mutation.mutate({ payload }); // Wrap payload in an object if mutationFn expects an object
  };

  const onCloseAndReset = () => {
    reset(defaultFormValues);
    setValue("date", format(new Date(), "yyyy-MM-dd"));
    setTransactionType(initialType);
    setFormError('');
    onClose(); // קורא לפונקציה שהועברה מ-TransactionsListPage
  };
  
  useEffect(() => {
    if (transactionType === 'expense' && !isEditMode) { // Only reset these fields if creating new, not editing
        if (watchedExpenseTypeOption === 'single') {
            setValue('frequency', undefined); setValue('interval', undefined); setValue('occurrences', undefined); setValue('endDate', undefined);
            setValue('totalAmount', undefined); setValue('numberOfInstallments', undefined);
        } else if (watchedExpenseTypeOption === 'recurring') {
            setValue('totalAmount', undefined); setValue('numberOfInstallments', undefined);
        } else if (watchedExpenseTypeOption === 'installment') {
            setValue('frequency', undefined); setValue('interval', undefined); setValue('occurrences', undefined); setValue('endDate', undefined);
        }
    }
  }, [watchedExpenseTypeOption, setValue, transactionType, isEditMode]);

  return (
    <Modal isOpen={isOpen} onClose={onCloseAndReset} title={isEditMode ? `עריכת ${transactionType === 'expense' ? 'הוצאה' : 'הכנסה'}` : `הוספת ${transactionType === 'expense' ? 'הוצאה' : 'הכנסה'}`} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* כפתורי בחירת סוג פעולה - מוסתרים במצב עריכה */}
        {!isEditMode && (
            <div className="flex border border-slate-300 rounded-md p-1 bg-slate-50 max-w-xs mx-auto">
            <button
                type="button"
                onClick={() => { setTransactionType('expense'); clearErrors(); reset({ ...defaultFormValues, date: format(new Date(), 'yyyy-MM-dd'), expenseTypeOption: 'single' }); }}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${transactionType === 'expense' ? 'bg-red-500 text-white shadow-md' : 'text-slate-600 hover:bg-red-100'}`}
            >
                הוצאה
            </button>
            <button
                type="button"
                onClick={() => { setTransactionType('income'); clearErrors(); reset({ ...defaultFormValues, date: format(new Date(), 'yyyy-MM-dd') }); }}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${transactionType === 'income' ? 'bg-green-500 text-white shadow-md' : 'text-slate-600 hover:bg-green-100'}`}
            >
                הכנסה
            </button>
            </div>
        )}
        
        {formError && <p className="text-sm text-red-600 bg-red-100 p-2 rounded-md">{formError}</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* ... (שדות Amount ו-Date כמו קודם) ... */}
            <div>
                <label htmlFor="amount" className="block text-sm font-medium text-slate-700 mb-1">סכום*</label>
                <input type="number" step="0.01" {...register("amount", { required: "סכום הוא שדה חובה", valueAsNumber: true, validate: value => value > 0 || "הסכום חייב להיות חיובי" })}
                    className={`w-full p-2.5 border rounded-md shadow-sm ${errors.amount ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:border-sky-500 focus:ring-sky-500'}`} placeholder="0.00" />
                {errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount.message}</p>}
            </div>
            <div>
                <label htmlFor="date" className="block text-sm font-medium text-slate-700 mb-1">תאריך*</label>
                <input type="date" {...register("date", { required: "תאריך הוא שדה חובה" })}
                    className={`w-full p-2.5 border rounded-md shadow-sm ${errors.date ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:border-sky-500 focus:ring-sky-500'}`} />
                {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date.message}</p>}
            </div>
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-1">תיאור</label>
          <input type="text" {...register("description")}
            className="w-full p-2.5 border border-slate-300 rounded-md shadow-sm focus:border-sky-500 focus:ring-sky-500" placeholder="לדוגמה: קניות בסופר" />
        </div>

        {transactionType === 'expense' && (
          <>
            {/* ... (שדות קטגוריה ואמצעי תשלום כמו קודם) ... */}
            <div>
              <label htmlFor="subcategoryId" className="block text-sm font-medium text-slate-700 mb-1">קטגוריה*</label>
              <select {...register("subcategoryId", { required: "קטגוריה היא שדה חובה", valueAsNumber:true })}
                className={`w-full p-2.5 border rounded-md shadow-sm bg-white ${errors.subcategoryId ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:border-sky-500 focus:ring-sky-500'}`}
                disabled={isLoadingCategories}
              >
                <option value="">{isLoadingCategories ? 'טוען קטגוריות...' : 'בחר קטגוריה'}</option>
                {categories?.filter(cat => cat.type === 'expense').map(cat => (
                  <optgroup label={cat.name} key={cat.id}>
                    {cat.subcategories.map(sub => (
                      <option value={sub.id} key={sub.id}>{sub.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {errors.subcategoryId && <p className="text-xs text-red-500 mt-1">{errors.subcategoryId.message}</p>}
            </div>
            <div>
              <label htmlFor="paymentMethod" className="block text-sm font-medium text-slate-700 mb-1">אמצעי תשלום</label>
              <input type="text" {...register("paymentMethod")}
                className="w-full p-2.5 border border-slate-300 rounded-md shadow-sm focus:border-sky-500 focus:ring-sky-500" placeholder="לדוגמה: אשראי" />
            </div>
            {/* בחירת סוג הוצאה - מוסתר במצב עריכה, כי אנחנו לא משנים סוג של הוצאה קיימת דרך טופס זה */}
            {!isEditMode && (
                <div className="pt-2">
                    {/* ... (קוד בחירת סוג הוצאה כמו קודם) ... */}
                    <label className="block text-sm font-medium text-slate-700 mb-2">סוג הוצאה</label>
                    <div className="flex space-x-4 space-x-reverse">
                        {['single', 'recurring', 'installment'].map(type => (
                        <label key={type} className="flex items-center space-x-2 space-x-reverse cursor-pointer">
                            <input type="radio" {...register("expenseTypeOption")} value={type}
                                className="form-radio h-4 w-4 text-sky-600 border-slate-300 focus:ring-sky-500"/>
                            <span className="text-sm text-slate-700">
                                {type === 'single' ? 'חד פעמית' : type === 'recurring' ? 'חוזרת' : 'תשלומים'}
                            </span>
                        </label>
                        ))}
                    </div>
                </div>
            )}

            {/* שדות להוצאה חוזרת - מוסתרים במצב עריכה (עריכת הגדרה תהיה במסך נפרד) */}
            {watchedExpenseTypeOption === 'recurring' && !isEditMode && (
              <div className="p-3 mt-3 border border-sky-200 rounded-md bg-sky-50 space-y-4">
                {/* ... (שדות הוצאה חוזרת כמו קודם) ... */}
                <h4 className="text-md font-medium text-sky-700">פרטי הוצאה חוזרת</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label htmlFor="frequency" className="block text-xs font-medium text-slate-600 mb-1">תדירות*</label><select {...register("frequency", { required: watchedExpenseTypeOption === 'recurring' ? "תדירות היא חובה" : false })} className={`w-full p-2 border rounded-md shadow-sm bg-white ${errors.frequency ? 'border-red-500' : 'border-slate-300'}`}><option value="monthly">חודשי</option><option value="weekly">שבועי</option><option value="daily">יומי</option><option value="annually">שנתי</option><option value="bi-monthly">דו-חודשי</option><option value="quarterly">רבעוני</option><option value="semi-annually">חצי-שנתי</option></select>{errors.frequency && <p className="text-xs text-red-500 mt-1">{errors.frequency.message}</p>}</div><div><label htmlFor="interval" className="block text-xs font-medium text-slate-600 mb-1">מרווח (ברירת מחדל: 1)</label><input type="number" {...register("interval", { valueAsNumber: true, min:1 })} defaultValue={1} className="w-full p-2 border border-slate-300 rounded-md shadow-sm" placeholder="1"/></div></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label htmlFor="occurrences" className="block text-xs font-medium text-slate-600 mb-1">מספר חזרות (אופציונלי)</label><input type="number" {...register("occurrences", { valueAsNumber: true, min:1, validate: v => !v || v > 0 || "חייב להיות גדול מ-0" })} className="w-full p-2 border border-slate-300 rounded-md shadow-sm" placeholder="לדוגמה: 12"/>{errors.occurrences && <p className="text-xs text-red-500 mt-1">{errors.occurrences.message}</p>}</div><div><label htmlFor="endDate" className="block text-xs font-medium text-slate-600 mb-1">תאריך סיום (אופציונלי)</label><input type="date" {...register("endDate", { validate: v => !v || isValid(parseISO(v)) || "תאריך לא תקין"})} className="w-full p-2 border border-slate-300 rounded-md shadow-sm"/>{errors.endDate && <p className="text-xs text-red-500 mt-1">{errors.endDate.message}</p>}</div></div>
              </div>
            )}

            {/* שדות לעסקת תשלומים - מוסתרים במצב עריכה */}
            {watchedExpenseTypeOption === 'installment' && !isEditMode && (
              <div className="p-3 mt-3 border border-teal-200 rounded-md bg-teal-50 space-y-4">
                {/* ... (שדות עסקת תשלומים כמו קודם) ... */}
                <h4 className="text-md font-medium text-teal-700">פרטי עסקת תשלומים</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label htmlFor="totalAmount" className="block text-xs font-medium text-slate-600 mb-1">סכום עסקה כולל*</label><input type="number" step="0.01" {...register("totalAmount", { required: watchedExpenseTypeOption === 'installment' ? "סכום כולל הוא חובה" : false, valueAsNumber: true, validate: v => v > 0 || "חייב להיות חיובי" })} className={`w-full p-2 border rounded-md shadow-sm ${errors.totalAmount ? 'border-red-500' : 'border-slate-300'}`} placeholder="0.00"/>{errors.totalAmount && <p className="text-xs text-red-500 mt-1">{errors.totalAmount.message}</p>}</div><div><label htmlFor="numberOfInstallments" className="block text-xs font-medium text-slate-600 mb-1">מספר תשלומים*</label><input type="number" {...register("numberOfInstallments", { required: watchedExpenseTypeOption === 'installment' ? "מספר תשלומים הוא חובה" : false, valueAsNumber: true, min: { value: 2, message: "לפחות 2 תשלומים"} })} className={`w-full p-2 border rounded-md shadow-sm ${errors.numberOfInstallments ? 'border-red-500' : 'border-slate-300'}`} placeholder="לדוגמה: 12"/>{errors.numberOfInstallments && <p className="text-xs text-red-500 mt-1">{errors.numberOfInstallments.message}</p>}</div></div>
              </div>
            )}
            
            {/* שדה isProcessed - יוצג רק במצב עריכה של מופע הוצאה */}
            {isEditMode && transactionToEdit && (transactionToEdit.expenseType === 'recurring_instance' || transactionToEdit.expenseType === 'installment_instance') && (
                 <div>
                    <label className="flex items-center space-x-2 space-x-reverse cursor-pointer mt-3">
                        <input type="checkbox" {...register("isProcessed")}
                            className="form-checkbox h-4 w-4 text-sky-600 border-slate-300 rounded focus:ring-sky-500"/>
                        <span className="text-sm text-slate-700">סמן כפעולה שבוצעה/עובדה</span>
                    </label>
                 </div>
            )}
          </>
        )}

        {transactionType === 'income' && (
          <div>
            {/* ... (שדה קטגוריית הכנסה כמו קודם) ... */}
            <label htmlFor="categoryId" className="block text-sm font-medium text-slate-700 mb-1">קטגוריית הכנסה</label>
            <select {...register("categoryId", {valueAsNumber: true})}
              className="w-full p-2.5 border border-slate-300 rounded-md shadow-sm bg-white focus:border-sky-500 focus:ring-sky-500"
              disabled={isLoadingCategories}
            >
              <option value="">{isLoadingCategories ? 'טוען קטגוריות...' : 'בחר קטגוריית הכנסה (אופציונלי)'}</option>
              {categories?.filter(cat => cat.type === 'income').map(cat => (
                <option value={cat.id} key={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex justify-end space-x-3 pt-4">
          {/* ... (כפתורי ביטול ושמור כמו קודם) ... */}
          <button type="button" onClick={onCloseAndReset} className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors"><FiXCircle className="inline mr-1 h-4 w-4" /> ביטול</button>
          <button type="submit" disabled={mutation.isLoading || isSubmitting} className="px-5 py-2.5 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center">{mutation.isLoading || isSubmitting ? ( <><svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>שומר...</> ) : ( <><FiSave className="inline mr-1 h-4 w-4" /> {isEditMode ? 'עדכן' : 'שמור'}</> )}</button>
        </div>
      </form>
    </Modal>
  );
};

export default AddTransactionModal;