// frontend/src/components/transactions/AddTransactionModal.jsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'; // הוספתי useCallback, useMemo, useRef
import Modal from '../ui/Modal';
import { useForm } from 'react-hook-form';
import apiClient from '../../api/apiClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FiSave, FiXCircle } from 'react-icons/fi';
import { format, parseISO, isValid } from 'date-fns';

const fetchCategories = async (type) => {
  const { data } = await apiClient.get(`/categories?type=${type}`);
  return data;
};

// הגדר מחוץ לקומפוננטה כדי שהרפרנס יהיה יציב
const initialDefaultFormValues = {
  amount: '',
  date: format(new Date(), 'yyyy-MM-dd'),
  description: '',
  subcategoryId: '',
  categoryId: '',
  paymentMethod: '',
  expenseTypeOption: 'single',
  rec_frequency: 'monthly',
  rec_interval: 1,
  rec_occurrences: '',
  rec_endDate: '',
  inst_totalAmount: '',
  inst_numberOfInstallments: '',
  isProcessed: false,
  isDefiningRecurringIncome_checkbox: false,
};

const recurringFrequencyOptions = [
  { value: 'monthly', label: 'חודשי' },
  { value: 'annually', label: 'שנתי' }
];

const AddTransactionModal = ({ isOpen, onClose, initialType = 'expense', transactionToEdit = null }) => {
  const queryClient = useQueryClient();
  const [transactionType, setTransactionType] = useState(initialType);
  const [formError, setFormError] = useState('');
  const isEditMode = !!transactionToEdit;
  const isEditingRecurringIncomeDef = isEditMode && transactionToEdit && transactionToEdit.isRecurringInstance && transactionToEdit.type === 'income';
  const isEditingRecurringExpenseDef = isEditMode && transactionToEdit && transactionToEdit.isRecurringInstance && transactionToEdit.type === 'expense';
  
  const { 
    register, 
    handleSubmit, 
    reset, 
    watch, 
    formState: { errors, isSubmitting }, // הסרתי dirtyFields אם לא בשימוש ישיר כאן
    setValue, 
    clearErrors,
    getValues // ניקח את getValues
  } = useForm({
    defaultValues: initialDefaultFormValues
  });

  const watchedExpenseTypeOption = watch("expenseTypeOption");
  const watchedIsDefiningRecurringIncome = watch("isDefiningRecurringIncome_checkbox");
  const [categorySearch, setCategorySearch] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const categoryInputRef = useRef(null);

  // useEffect לאכלוס הטופס במצב עריכה או איפוס
  useEffect(() => {
    setTransactionType(initialType);
    if (isEditingRecurringIncomeDef && transactionToEdit) {
      // עריכת הגדרה של הכנסה חוזרת
      reset({
        amount: transactionToEdit.amount,
        date: transactionToEdit.date || initialDefaultFormValues.date,
        description: transactionToEdit.description?.replace(' (מתוכנן)', '') || '',
        categoryId: transactionToEdit.categoryId || '',
        rec_frequency: transactionToEdit.frequency || initialDefaultFormValues.rec_frequency,
        rec_interval: transactionToEdit.interval || initialDefaultFormValues.rec_interval,
        rec_occurrences: transactionToEdit.occurrences || '',
        rec_endDate: transactionToEdit.endDate || '',
        isDefiningRecurringIncome_checkbox: true,
      });
      setTransactionType('income');
    } else if (isEditingRecurringExpenseDef && transactionToEdit) {
      // עריכת הגדרה של הוצאה חוזרת
      reset({
        amount: transactionToEdit.amount,
        date: transactionToEdit.date || initialDefaultFormValues.date,
        description: transactionToEdit.description?.replace(' (מתוכנן)', '') || '',
        subcategoryId: transactionToEdit.subcategoryId || '',
        paymentMethod: transactionToEdit.paymentMethod || '',
        expenseTypeOption: 'recurring',
        rec_frequency: transactionToEdit.frequency || initialDefaultFormValues.rec_frequency,
        rec_interval: transactionToEdit.interval || initialDefaultFormValues.rec_interval,
        rec_occurrences: transactionToEdit.occurrences || '',
        rec_endDate: transactionToEdit.endDate || '',
      });
      setTransactionType('expense');
    } else if (isEditMode && transactionToEdit) {
        const currentType = transactionToEdit.type || transactionToEdit.transactionType || 'expense';
        setTransactionType(currentType);
        
        const subId = transactionToEdit.subcategory?.id || transactionToEdit.subcategoryId || '';
        const catId = transactionToEdit.category?.id || transactionToEdit.categoryId || '';

        // אכלוס ראשוני
        reset({ // שימוש ב-reset לאכלוס ראשוני במצב עריכה
            amount: transactionToEdit.amount,
            date: transactionToEdit.date ? format(parseISO(transactionToEdit.date), 'yyyy-MM-dd') : initialDefaultFormValues.date,
            description: transactionToEdit.description || '',
            subcategoryId: currentType === 'expense' ? subId : '',
            categoryId: currentType === 'income' ? catId : '',
            paymentMethod: transactionToEdit.paymentMethod || '',
            expenseTypeOption: transactionToEdit.expenseType || 'single',
            isProcessed: transactionToEdit.isProcessed !== undefined ? transactionToEdit.isProcessed : false,
            isDefiningRecurringIncome_checkbox: false, // לא מגדירים חדש בעריכה
            // אפס שדות של recurring/installment לערכי ברירת מחדל
            rec_frequency: initialDefaultFormValues.rec_frequency,
            rec_interval: initialDefaultFormValues.rec_interval,
            rec_occurrences: initialDefaultFormValues.rec_occurrences,
            rec_endDate: initialDefaultFormValues.rec_endDate,
            inst_totalAmount: initialDefaultFormValues.inst_totalAmount,
            inst_numberOfInstallments: initialDefaultFormValues.inst_numberOfInstallments,
        });
    } else {
        const resetDate = format(new Date(), "yyyy-MM-dd");
        reset({...initialDefaultFormValues, date: resetDate, expenseTypeOption: initialType === 'expense' ? 'single' : initialDefaultFormValues.expenseTypeOption, isDefiningRecurringIncome_checkbox: false});
        // אם initialType הוא income, expenseTypeOption יתאפס ל-single
        // isDefiningRecurringIncome_checkbox יתאפס ל-false
    }
  }, [transactionToEdit, isEditMode, reset, initialType]); // הסרתי setValue


  const { data: categories, isLoading: isLoadingCategories } = useQuery({
    queryKey: ['categories', transactionType],
    queryFn: () => fetchCategories(transactionType),
    enabled: isOpen && (transactionType === 'expense' || transactionType === 'income'),
  });

  const mutation = useMutation({
    mutationFn: (requestData) => {
      const { method, endpoint, payload } = requestData;
      if (method === 'put') {
        return apiClient.put(endpoint, payload);
      }
      return apiClient.post(endpoint, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['incomes'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      ['dashboardSummary', 'recentTransactions', 'expenseDistribution'].forEach(key => 
        queryClient.invalidateQueries({ queryKey: [key], exact: true })
      );
      console.log(`${transactionType} ${isEditMode ? 'updated' : 'added'} successfully!`);
      onCloseAndReset();
    },
    onError: (error) => {
      console.error(`Error ${isEditMode ? 'updating' : 'adding'} ${transactionType}:`, error);
      const apiErrorMessage = error.response?.data?.errors?.[0]?.msg || error.response?.data?.message;
      setFormError(apiErrorMessage || `Failed to ${isEditMode ? 'update' : 'add'} ${transactionType}.`);
    }
  });

  
const onSubmit = (data) => {
    console.log('--- Raw data from RHF ---:', data);
    setFormError('');

    // ולידציה בסיסית בצד הלקוח לפני בניית payload
    const parsedAmount = parseFloat(data.amount);
    if ((data.expenseTypeOption !== 'installment' || !data.isDefiningRecurringIncome_checkbox) && (isNaN(parsedAmount) || parsedAmount <= 0) && !isEditingDefinition ) {
        // עבור תשלומים, השדה amount הראשי לא רלוונטי ליצירת ההגדרה
        // עבור הכנסה חוזרת, amount כן רלוונטי
        if (!(transactionType === 'income' && data.isDefiningRecurringIncome_checkbox)) {
            setFormError("הסכום שהוזן אינו תקין או חסר.");
            return;
        }
    }
    if (!data.date || !isValid(parseISO(data.date))) {
        setFormError("התאריך שהוזן אינו תקין או חסר.");
        return;
    }

    let payload = {
        amount: parsedAmount, // ישמש כ-amount רגיל או סכום חזרה
        date: format(parseISO(data.date), 'yyyy-MM-dd'), // ישמש כ-date, startDate או firstPaymentDate
        description: data.description || null,
    };
    let endpoint = '';
    let method = isEditMode ? 'put' : 'post'; // כולל isEditingDefinition

    if (transactionType === 'income') {
        payload.categoryId = data.categoryId ? parseInt(data.categoryId, 10) : undefined;
        const incomeTypeOption = data.incomeTypeOption || 'single';
        if (incomeTypeOption === 'recurring' && !isEditMode) {
            endpoint = '/recurring-income-definitions';
            payload.startDate = payload.date;
            payload.frequency = data.rec_frequency;
            payload.interval = data.rec_interval ? parseInt(data.rec_interval, 10) : 1;
            if (data.rec_occurrences) payload.occurrences = parseInt(data.rec_occurrences, 10);
            if (data.rec_endDate && isValid(parseISO(data.rec_endDate))) payload.endDate = format(parseISO(data.rec_endDate), 'yyyy-MM-dd');
            delete payload.date;
        } else if (isEditingRecurringIncomeDef && transactionToEdit) {
            endpoint = `/recurring-income-definitions/${transactionToEdit.id}`;
            payload.startDate = payload.date;
            payload.frequency = data.rec_frequency;
            payload.interval = data.rec_interval ? parseInt(data.rec_interval, 10) : 1;
            if (data.rec_occurrences !== undefined) payload.occurrences = data.rec_occurrences ? parseInt(data.rec_occurrences, 10) : null;
            if (data.rec_endDate !== undefined) payload.endDate = data.rec_endDate && isValid(parseISO(data.rec_endDate)) ? format(parseISO(data.rec_endDate), 'yyyy-MM-dd') : null;
            payload.isActive = transactionToEdit.isActive;
            delete payload.date;
        } else {
            endpoint = isEditMode ? `/incomes/${transactionToEdit.id}` : '/incomes';
        }
    } else { // Expense
        payload.subcategoryId = data.subcategoryId ? parseInt(data.subcategoryId, 10) : undefined; // צריך להיות חובה להוצאה
        if (!payload.subcategoryId && !isEditingDefinition) { // בדיקה אם זה יצירת הוצאה חדשה ללא קטגוריה
            setFormError("יש לבחור קטגוריה להוצאה.");
            return;
        }
        payload.paymentMethod = data.paymentMethod || null;
        
        if (isEditingRecurringExpenseDef && transactionToEdit) { // עריכת הגדרת הוצאה חוזרת
            endpoint = `/recurring-definitions/${transactionToEdit.id}`; // ודא שהנתיב נכון
            payload.startDate = payload.date;
            payload.frequency = data.rec_frequency;
            payload.interval = data.rec_interval ? parseInt(data.rec_interval, 10) : 1;
            if (data.rec_occurrences !== undefined) payload.occurrences = data.rec_occurrences ? parseInt(data.rec_occurrences, 10) : null;
            if (data.rec_endDate !== undefined) payload.endDate = data.rec_endDate && isValid(parseISO(data.rec_endDate)) ? format(parseISO(data.rec_endDate), 'yyyy-MM-dd') : null;
            payload.isActive = transactionToEdit.isActive;
            delete payload.date;
        } else if (!isEditMode) { // יצירה חדשה של הוצאה
            payload.expenseType = data.expenseTypeOption;
            endpoint = '/expenses'; // ה-API המאוחד שלך ליצירת הוצאות/הגדרות

            if (data.expenseTypeOption === 'recurring') {
                payload.startDate = payload.date;
                payload.frequency = data.rec_frequency;
                payload.interval = data.rec_interval ? parseInt(data.rec_interval, 10) : 1;
                if (data.rec_occurrences) payload.occurrences = parseInt(data.rec_occurrences, 10);
                if (data.rec_endDate && isValid(parseISO(data.rec_endDate))) payload.endDate = format(parseISO(data.rec_endDate), 'yyyy-MM-dd');
                delete payload.date; 
            } else if (data.expenseTypeOption === 'installment') {
                // amount הופך ל-totalAmount
                payload.totalAmount = payload.amount; 
                payload.numberOfInstallments = data.inst_numberOfInstallments ? parseInt(data.inst_numberOfInstallments, 10) : undefined;
                payload.firstPaymentDate = payload.date;
                if (!payload.totalAmount || payload.totalAmount <= 0) {setFormError("סכום עסקה כולל חסר או לא תקין."); return;}
                if (!payload.numberOfInstallments || payload.numberOfInstallments < 2) {setFormError("מספר תשלומים חסר או לא תקין."); return;}
                delete payload.amount; 
                delete payload.date;
            } else { // single
                 payload.isProcessed = true;
            }
        } else { // עריכת מופע הוצאה קיים
            payload.isProcessed = data.isProcessed !== undefined ? data.isProcessed : (transactionToEdit?.isProcessed || false);
            payload.expenseType = transactionToEdit.expenseType; 
            if(transactionToEdit.parentId) payload.parentId = transactionToEdit.parentId;
            endpoint = `/expenses/${transactionToEdit.id}`;
        }
    }
    
    // בדיקה אחרונה לפני שליחה
    if ((endpoint.includes('recurring') || endpoint.includes('installment')) && (payload.amount === undefined && payload.totalAmount === undefined)) {
        // אם יוצרים הגדרה, ואין amount (להגדרה חוזרת) או totalAmount (לתשלומים)
        // וה-amount הכללי הוא NaN (למשל, אם שדה הסכום הראשי היה ריק)
        if (isNaN(parsedAmount)) {
            setFormError("סכום חסר עבור הגדרה חוזרת או תשלומים.");
            return;
        }
        // אם זה הגדרת תשלומים, amount המקורי נמחק, אז אין טעם להשתמש בו
        if (!endpoint.includes('installment')) {
             payload.amount = parsedAmount; // ודא ש-amount קיים להגדרות חוזרות
        }
    }


    console.log('Submitting to endpoint:', endpoint, 'with payload:', payload);
    if (!endpoint) {
        setFormError("לא ניתן לקבוע את נקודת הקצה לשליחה. בדוק את סוג הפעולה.");
        return;
    }
    mutation.mutate({ method, endpoint, payload });
  };
  const onCloseAndReset = useCallback(() => { // עטפתי ב-useCallback
    const resetDate = format(new Date(), "yyyy-MM-dd");
    reset({...initialDefaultFormValues, date: resetDate});
    setTransactionType(initialType);
    setFormError('');
    onClose(); 
  }, [reset, initialType, onClose]); // הוספתי תלויות יציבות
  
  // useEffect לניקוי שדות מותנה
  useEffect(() => {
    if (!isEditMode) {
      const currentValues = getValues(); // קבל את הערכים הנוכחיים
      const newValuesToSet = {};
      let changed = false;

      if (transactionType === 'expense') {
        if (watchedExpenseTypeOption !== 'recurring') {
          if (currentValues.rec_frequency !== initialDefaultFormValues.rec_frequency) { newValuesToSet.rec_frequency = initialDefaultFormValues.rec_frequency; changed = true; }
          if (currentValues.rec_interval !== initialDefaultFormValues.rec_interval) { newValuesToSet.rec_interval = initialDefaultFormValues.rec_interval; changed = true; }
          // ... וכן הלאה לשאר שדות recurring
        }
        if (watchedExpenseTypeOption !== 'installment') {
          if (currentValues.inst_totalAmount !== initialDefaultFormValues.inst_totalAmount) { newValuesToSet.inst_totalAmount = initialDefaultFormValues.inst_totalAmount; changed = true; }
          // ... וכן הלאה לשאר שדות installment
        }
        if (currentValues.isDefiningRecurringIncome_checkbox !== false) { newValuesToSet.isDefiningRecurringIncome_checkbox = false; changed = true; }
      } else if (transactionType === 'income') {
        if (currentValues.expenseTypeOption !== 'single') { newValuesToSet.expenseTypeOption = 'single'; changed = true; }
        // אפס שדות הוצאה חוזרת/תשלומים
        if (currentValues.rec_frequency !== initialDefaultFormValues.rec_frequency) { newValuesToSet.rec_frequency = initialDefaultFormValues.rec_frequency; changed = true; }
        // ...
        if (!watchedIsDefiningRecurringIncome) {
          if (currentValues.rec_frequency !== initialDefaultFormValues.rec_frequency) { newValuesToSet.rec_frequency = initialDefaultFormValues.rec_frequency; changed = true; }
          // ... וכן הלאה לשאר שדות recurring income
        }
      }
      if (changed) {
        Object.entries(newValuesToSet).forEach(([key, value]) => {
            setValue(key, value);
        });
      }
    }
  }, [watchedExpenseTypeOption, watchedIsDefiningRecurringIncome, transactionType, isEditMode, setValue, getValues]); // הוספתי getValues


  // מיון לפי פופולריות (בהנחה שיש שדה usageCount, אחרת לפי שם)
  const sortedCategories = useMemo(() => {
    if (!categories) return [];
    let cats = categories.filter(cat => cat.type === transactionType);
    if (transactionType === 'income') {
      cats = cats.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
    } else {
      cats = cats.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
    }
    if (categorySearch) {
      const search = categorySearch.toLowerCase();
      cats = cats.filter(cat => (cat.name_he || cat.name || '').toLowerCase().includes(search));
    }
    return cats;
  }, [categories, transactionType, categorySearch]);


  // --- Autocomplete for expense subcategory ---
  const [subcategorySearch, setSubcategorySearch] = useState('');
  const [showSubcategoryDropdown, setShowSubcategoryDropdown] = useState(false);
  const subcategoryInputRef = useRef(null);

  const allExpenseSubcategories = useMemo(() => {
    if (!categories) return [];
    // Flatten all subcategories with parent info
    return categories
      .filter(cat => cat.type === 'expense')
      .flatMap(cat =>
        (cat.subcategories || []).map(sub => ({
          ...sub,
          parentName: cat.name_he || cat.name,
          parentUsage: cat.usageCount || 0
        }))
      );
  }, [categories]);

  const sortedExpenseSubcategories = useMemo(() => {
    let subs = allExpenseSubcategories;
    if (subcategorySearch) {
      const search = subcategorySearch.toLowerCase();
      subs = subs.filter(sub =>
        (sub.name_he || sub.name || '').toLowerCase().includes(search) ||
        (sub.parentName || '').toLowerCase().includes(search)
      );
    }
    // Sort by usageCount (subcategory), then parent usage, then name
    return subs.sort((a, b) =>
      (b.usageCount || 0) - (a.usageCount || 0) ||
      (b.parentUsage || 0) - (a.parentUsage || 0) ||
      (a.name_he || a.name || '').localeCompare(b.name_he || b.name || '')
    );
  }, [allExpenseSubcategories, subcategorySearch]);


  return (
    <Modal isOpen={isOpen} onClose={onCloseAndReset} title={isEditMode ? `עריכת ${transactionType === 'expense' ? 'הוצאה' : 'הכנסה'}` : `הוספת ${transactionType === 'expense' ? 'הוצאה' : 'הכנסה'}`} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Main expense/income toggle */}
        {!isEditMode && (
            <div className="flex border border-slate-300 rounded-md p-1 bg-slate-50 max-w-xs mx-auto mb-2">
            <button type="button" onClick={() => { 
                setTransactionType('expense'); 
                clearErrors(); 
                reset({ ...initialDefaultFormValues, date: format(new Date(), 'yyyy-MM-dd'), expenseTypeOption: 'single', isDefiningRecurringIncome_checkbox: false }); 
            }}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${transactionType === 'expense' ? 'bg-red-500 text-white shadow-md' : 'text-slate-600 hover:bg-red-100'}`}>הוצאה</button>
            <button type="button" onClick={() => { 
                setTransactionType('income'); 
                clearErrors(); 
                reset({ ...initialDefaultFormValues, date: format(new Date(), 'yyyy-MM-dd'), expenseTypeOption: 'single', isDefiningRecurringIncome_checkbox: false }); 
            }}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${transactionType === 'income' ? 'bg-green-500 text-white shadow-md' : 'text-slate-600 hover:bg-green-100'}`}>הכנסה</button>
            </div>
        )}

        {/* Income type toggle (single/recurring) - only for income, always at the top */}
        {!isEditMode && transactionType === 'income' && (
          <div className="flex border border-green-300 rounded-md p-1 bg-green-50 max-w-xs mx-auto mb-2">
            {['single', 'recurring'].map(type => (
              <button
                key={type}
                type="button"
                onClick={() => setValue('incomeTypeOption', type)}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${watch('incomeTypeOption') === type ? 'bg-green-500 text-white shadow-md' : 'text-slate-600 hover:bg-green-100'}`}
              >
                {type === 'single' ? 'חד פעמית' : 'חוזרת'}
              </button>
            ))}
          </div>
        )}

        {/* Expense type toggle (single/recurring/installment) - only for expense */}
        {!isEditMode && transactionType === 'expense' && (
          <div className="flex border border-red-300 rounded-md p-1 bg-red-50 max-w-xs mx-auto mb-2">
            {['single', 'recurring', 'installment'].map(type => (
              <button key={type} type="button" onClick={() => setValue("expenseTypeOption", type)} 
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${watchedExpenseTypeOption === type ? (type === 'single' ? 'bg-red-500 text-white shadow-md' : type === 'recurring' ? 'bg-orange-500 text-white shadow-md' : 'bg-teal-500 text-white shadow-md') : 'text-slate-600 hover:bg-red-100'}`}>
                {type === 'single' ? 'חד פעמית' : type === 'recurring' ? 'חוזרת' : 'תשלומים'}
              </button>
            ))}
          </div>
        )}

        {formError && <p className="text-sm text-red-600 bg-red-100 p-3 rounded-md text-center">{formError}</p>}

        {!isEditingRecurringIncomeDef && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="amount" className="block text-sm font-medium text-slate-700 mb-1">סכום*</label>
                <input type="number" id="amount" step="0.01" {...register("amount", { required: "סכום הוא שדה חובה", valueAsNumber: true, validate: value => (value !== undefined && value !== null && value > 0) || "הסכום חייב להיות חיובי" })}
                  className={`w-full p-2.5 border rounded-md shadow-sm ${errors.amount ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:border-sky-500 focus:ring-sky-500'}`} placeholder="0.00" />
                {errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount.message}</p>}
              </div>
              <div>
                <label htmlFor="date" className="block text-sm font-medium text-slate-700 mb-1">
                  תאריך*
                  {transactionType === 'expense' && !isEditMode && watchedExpenseTypeOption === 'recurring' ? ' (ת.התחלה)' : ''}
                  {transactionType === 'expense' && !isEditMode && watchedExpenseTypeOption === 'installment' ? ' (ת.תשלום 1)' : ''}
                  {transactionType === 'income' && watchedIsDefiningRecurringIncome && !isEditMode ? ' (ת.התחלה)' : ''}
                </label>
                <input type="date" id="date" {...register("date", { required: "תאריך הוא שדה חובה" })}
                  className={`w-full p-2.5 border rounded-md shadow-sm ${errors.date ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:border-sky-500 focus:ring-sky-500'}`} />
                {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date.message}</p>}
              </div>
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-1">תיאור</label>
              <input type="text" id="description" {...register("description")}
                className="w-full p-2.5 border border-slate-300 rounded-md shadow-sm focus:border-sky-500 focus:ring-sky-500" placeholder="לדוגמה: קניות בסופר" />
            </div>
          </>
        )}

        {transactionType === 'income' && !isEditingRecurringIncomeDef && (
          <>
            {/* --- הכנסה: סוג הכנסה (חד פעמית/חוזרת) --- */}
            {/* (Remove this block, already handled at the top) */}

            {/* שדות הכנסה רגילה (רק אם לא עריכת חוזרת ולא חוזרת) */}
            {transactionType === 'income' && !isEditingRecurringIncomeDef && (watch('incomeTypeOption') !== 'recurring' || isEditMode) && (
              <></>
            )}
          </>
        )}

        {transactionType === 'income' && !isEditingRecurringIncomeDef && !isEditMode &&  watch('incomeTypeOption') == 'recurring' && (
          <div>
            <label htmlFor="categoryId" className="block text-sm font-medium text-slate-700 mb-1">קטגוריית הכנסה</label>
            <div className="relative">
              <input
                type="text"
                id="categoryId"
                ref={categoryInputRef}
                value={categorySearch !== '' ? categorySearch : (categories?.find(cat => cat.id === Number(getValues('categoryId')))?.name_he || '')}
                onFocus={() => setShowCategoryDropdown(true)}
                onBlur={() => setTimeout(() => setShowCategoryDropdown(false), 200)}
                onChange={e => {
                  setCategorySearch(e.target.value);
                  setValue('categoryId', '');
                }}
                placeholder="התחל להקליד קטגוריה..."
                className="w-full p-2.5 border border-slate-300 rounded-md bg-white focus:border-sky-500 focus:ring-sky-500"
                autoComplete="off"
              />
              {showCategoryDropdown && sortedCategories.length > 0 && (
                <ul className="absolute z-10 w-full bg-white border border-slate-300 rounded-md mt-1 max-h-48 overflow-y-auto shadow-lg">
                  {sortedCategories.map(cat => (
                    <li
                      key={cat.id}
                      className="px-4 py-2 hover:bg-sky-100 cursor-pointer text-sm"
                      onMouseDown={() => {
                        setValue('categoryId', cat.id);
                        setCategorySearch(cat.name_he || cat.name);
                        setShowCategoryDropdown(false);
                      }}
                    >
                      {cat.name_he || cat.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {transactionType === 'income' && !isEditingRecurringIncomeDef && (
          <>
            {/* --- הכנסה: סוג הכנסה (חד פעמית/חוזרת) --- */}
            {/* (Remove this block, already handled at the top) */}

            {/* שדות הכנסה רגילה (רק אם לא עריכת חוזרת ולא חוזרת) */}
            {transactionType === 'income' && !isEditingRecurringIncomeDef && (watch('incomeTypeOption') !== 'recurring' || isEditMode) && (
              <>
                <div>
                  <label htmlFor="categoryId" className="block text-sm font-medium text-slate-700 mb-1">קטגוריית הכנסה</label>
                  <div className="relative">
                    <input
                      type="text"
                      id="categoryId"
                      ref={categoryInputRef}
                      value={categorySearch !== '' ? categorySearch : (categories?.find(cat => cat.id === Number(getValues('categoryId')))?.name_he || '')}
                      onFocus={() => setShowCategoryDropdown(true)}
                      onBlur={() => setTimeout(() => setShowCategoryDropdown(false), 200)}
                      onChange={e => {
                        setCategorySearch(e.target.value);
                        setValue('categoryId', '');
                      }}
                      placeholder="התחל להקליד קטגוריה..."
                      className="w-full p-2.5 border border-slate-300 rounded-md bg-white focus:border-sky-500 focus:ring-sky-500"
                      autoComplete="off"
                    />
                    {showCategoryDropdown && sortedCategories.length > 0 && (
                      <ul className="absolute z-10 w-full bg-white border border-slate-300 rounded-md mt-1 max-h-48 overflow-y-auto shadow-lg">
                        {sortedCategories.map(cat => (
                          <li
                            key={cat.id}
                            className="px-4 py-2 hover:bg-sky-100 cursor-pointer text-sm"
                            onMouseDown={() => {
                              setValue('categoryId', cat.id);
                              setCategorySearch(cat.name_he || cat.name);
                              setShowCategoryDropdown(false);
                            }}
                          >
                            {cat.name_he || cat.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* שדות הכנסה חוזרת (בהוספה בלבד, לא בעריכה) */}
            {transactionType === 'income' && !isEditMode && !isEditingRecurringIncomeDef && watch('incomeTypeOption') === 'recurring' && (
              <div className="p-3 mt-3 border border-green-200 rounded-md bg-green-50 space-y-4">
                <h4 className="text-md font-medium text-green-700">פרטי הכנסה חוזרת</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label htmlFor="rec_frequency_inc" className="block text-xs font-medium text-slate-600 mb-1">תדירות*</label><select id="rec_frequency_inc" {...register("rec_frequency", { required: watch('incomeTypeOption') === 'recurring' ? "תדירות היא חובה" : false })} className={`w-full p-2 border rounded-md shadow-sm bg-white ${errors.rec_frequency ? 'border-red-500' : 'border-slate-300'}`}><option value="monthly">חודשי</option><option value="annually">שנתי</option></select>{errors.rec_frequency && <p className="text-xs text-red-500 mt-1">{errors.rec_frequency.message}</p>}</div>
                  <div><label htmlFor="rec_interval_inc" className="block text-xs font-medium text-slate-600 mb-1">מרווח</label><input type="number" id="rec_interval_inc" {...register("rec_interval", { valueAsNumber: true, min:1, setValueAs: v => parseInt(v) || 1 })} defaultValue={1} className="w-full p-2 border border-slate-300 rounded-md shadow-sm" placeholder="1"/></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label htmlFor="rec_occurrences_inc" className="block text-xs font-medium text-slate-600 mb-1">מספר חזרות</label><input type="number" id="rec_occurrences_inc" {...register("rec_occurrences", { valueAsNumber: true, validate: v => !v || (Number.isInteger(v) && v > 0) || "חייב להיות מספר שלם גדול מ-0" })} className="w-full p-2 border border-slate-300 rounded-md shadow-sm" placeholder="אופציונלי"/>{errors.rec_occurrences && <p className="text-xs text-red-500 mt-1">{errors.rec_occurrences.message}</p>}</div>
                  <div><label htmlFor="rec_endDate_inc" className="block text-xs font-medium text-slate-600 mb-1">תאריך סיום</label><input type="date" id="rec_endDate_inc" {...register("rec_endDate", { validate: v => !v || isValid(parseISO(v)) || "תאריך לא תקין"})} className="w-full p-2 border border-slate-300 rounded-md shadow-sm"/>{errors.rec_endDate && <p className="text-xs text-red-500 mt-1">{errors.rec_endDate.message}</p>}</div>
                </div>
              </div>
            )}
          </>
        )}

        {transactionType === 'expense' && (
          <>
            <div>
              <label htmlFor="subcategoryId" className="block text-sm font-medium text-slate-700 mb-1">קטגוריה*</label>
              <div className="relative">
                <input
                  type="text"
                  id="subcategoryId"
                  ref={subcategoryInputRef}
                  value={subcategorySearch !== '' ? subcategorySearch : (() => {
                    const selected = allExpenseSubcategories.find(sub => sub.id === Number(getValues('subcategoryId')));
                    return selected ? `${selected.name_he || selected.name} (${selected.parentName})` : '';
                  })()}
                  onFocus={() => setShowSubcategoryDropdown(true)}
                  onBlur={() => setTimeout(() => setShowSubcategoryDropdown(false), 200)}
                  onChange={e => {
                    setSubcategorySearch(e.target.value);
                    setValue('subcategoryId', '');
                  }}
                  placeholder="התחל להקליד קטגוריה..."
                  className={`w-full p-2.5 border border-slate-300 rounded-md bg-white focus:border-sky-500 focus:ring-sky-500 ${errors.subcategoryId ? 'border-red-500 focus:ring-red-500' : ''}`}
                  autoComplete="off"
                />
                {showSubcategoryDropdown && sortedExpenseSubcategories.length > 0 && (
                  <ul className="absolute z-10 w-full bg-white border border-slate-300 rounded-md mt-1 max-h-48 overflow-y-auto shadow-lg">
                    {sortedExpenseSubcategories.map(sub => (
                      <li
                        key={sub.id}
                        className="px-4 py-2 hover:bg-sky-100 cursor-pointer text-sm"
                        onMouseDown={() => {
                          setValue('subcategoryId', sub.id);
                          setSubcategorySearch(`${sub.name_he || sub.name} (${sub.parentName})`);
                          setShowSubcategoryDropdown(false);
                        }}
                      >
                        {sub.name_he || sub.name} <span className="text-xs text-slate-400">({sub.parentName})</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {errors.subcategoryId && <p className="text-xs text-red-500 mt-1">{errors.subcategoryId.message}</p>}
            </div>
            <div>
              <label htmlFor="paymentMethod" className="block text-sm font-medium text-slate-700 mb-1">אמצעי תשלום</label>
              <input type="text" id="paymentMethod" {...register("paymentMethod")}
                className="w-full p-2.5 border border-slate-300 rounded-md shadow-sm focus:border-sky-500 focus:ring-sky-500" placeholder="לדוגמה: אשראי" />
            </div>
            
            {watchedExpenseTypeOption === 'recurring' && !isEditMode && (
              <div className="p-3 mt-3 border border-orange-200 rounded-md bg-orange-50 space-y-4">
                <h4 className="text-md font-medium text-orange-700">פרטי הוצאה חוזרת</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="rec_frequency_exp" className="block text-xs font-medium text-slate-600 mb-1">תדירות*</label>
                    <select id="rec_frequency_exp" {...register("rec_frequency", { required: watchedExpenseTypeOption === 'recurring' ? "תדירות היא חובה" : false })} className={`w-full p-2 border rounded-md shadow-sm bg-white ${errors.rec_frequency ? 'border-red-500' : 'border-slate-300'}`}> 
                        <option value="monthly">חודשי</option>
                        <option value="annually">שנתי</option>
                    </select>
                    {errors.rec_frequency && <p className="text-xs text-red-500 mt-1">{errors.rec_frequency.message}</p>}
                  </div>
                  <div>
                    <label htmlFor="rec_interval_exp" className="block text-xs font-medium text-slate-600 mb-1">מרווח</label>
                    <input type="number" id="rec_interval_exp" {...register("rec_interval", { 
        valueAsNumber: true, 
        min: { value: 1, message: "המרווח חייב להיות גדול מ-0" },
        validate: {
            isInteger: v => Number.isInteger(v) || "המרווח חייב להיות מספר שלם"
        },
        setValueAs: v => parseInt(v) || 1 
    })} defaultValue={1} className="w-full p-2 border border-slate-300 rounded-md shadow-sm" placeholder="1"/>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="rec_occurrences_exp" className="block text-xs font-medium text-slate-600 mb-1">מספר חזרות</label>
                    <input type="number" id="rec_occurrences_exp" {...register("rec_occurrences", { valueAsNumber: true, validate: v => !v || (Number.isInteger(v) && v > 0) || "חייב להיות מספר שלם גדול מ-0" })} className="w-full p-2 border border-slate-300 rounded-md shadow-sm" placeholder="אופציונלי"/>
                    {errors.rec_occurrences && <p className="text-xs text-red-500 mt-1">{errors.rec_occurrences.message}</p>}
                  </div>
                  <div>
                    <label htmlFor="rec_endDate_exp" className="block text-xs font-medium text-slate-600 mb-1">תאריך סיום</label>
                    <input type="date" id="rec_endDate_exp" {...register("rec_endDate", { validate: v => !v || isValid(parseISO(v)) || "תאריך לא תקין"})} className="w-full p-2 border border-slate-300 rounded-md shadow-sm"/>
                    {errors.rec_endDate && <p className="text-xs text-red-500 mt-1">{errors.rec_endDate.message}</p>}
                  </div>
                </div>
              </div>
            )}

            {watchedExpenseTypeOption === 'installment' && !isEditMode && (
              <div className="p-3 mt-3 border border-teal-200 rounded-md bg-teal-50 space-y-4">
                <h4 className="text-md font-medium text-teal-700">פרטי עסקת תשלומים</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label htmlFor="inst_totalAmount" className="block text-xs font-medium text-slate-600 mb-1">סכום עסקה כולל*</label><input type="number" id="inst_totalAmount" step="0.01" {...register("inst_totalAmount", { required: watchedExpenseTypeOption === 'installment' ? "סכום כולל הוא חובה" : false, valueAsNumber: true, validate: v => (v !== undefined && v !== null && v > 0) || "חייב להיות חיובי" })} className={`w-full p-2 border rounded-md shadow-sm ${errors.inst_totalAmount ? 'border-red-500' : 'border-slate-300'}`} placeholder="0.00"/>{errors.inst_totalAmount && <p className="text-xs text-red-500 mt-1">{errors.inst_totalAmount.message}</p>}</div><div><label htmlFor="inst_numberOfInstallments" className="block text-xs font-medium text-slate-600 mb-1">מספר תשלומים*</label><input type="number" id="inst_numberOfInstallments" {...register("inst_numberOfInstallments", { required: watchedExpenseTypeOption === 'installment' ? "מספר תשלומים הוא חובה" : false, valueAsNumber: true, min: { value: 2, message: "לפחות 2 תשלומים"} })} className={`w-full p-2 border rounded-md shadow-sm ${errors.inst_numberOfInstallments ? 'border-red-500' : 'border-slate-300'}`} placeholder="לדוגמה: 12"/>{errors.inst_numberOfInstallments && <p className="text-xs text-red-500 mt-1">{errors.inst_numberOfInstallments.message}</p>}</div></div>
              </div>
            )}
            
            {isEditMode && transactionToEdit && (transactionToEdit.expenseType === 'recurring_instance' || transactionToEdit.expenseType === 'installment_instance') && (
                 <div>
                    {/* Removed checkbox for recurring income definition editing */}
                 </div>
            )}
          </>
        )}

        {isEditingRecurringIncomeDef && (
          <div className="p-3 mt-3 border border-green-200 rounded-md bg-green-50 space-y-4">
            <h4 className="text-md font-medium text-green-700">עריכת הכנסה חוזרת</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="amount" className="block text-sm font-medium text-slate-700 mb-1">סכום*</label>
                <input type="number" id="amount" step="0.01" {...register("amount", { required: "סכום הוא שדה חובה", valueAsNumber: true, validate: value => (value !== undefined && value !== null && value > 0) || "הסכום חייב להיות חיובי" })}
                  className={`w-full p-2.5 border rounded-md shadow-sm ${errors.amount ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:border-orange-500 focus:ring-orange-500'}`} placeholder="0.00" />
                {errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount.message}</p>}
              </div>
              <div>
                <label htmlFor="date" className="block text-sm font-medium text-slate-700 mb-1">תאריך התחלה*</label>
                <input type="date" id="date" {...register("date", { required: "תאריך הוא שדה חובה" })}
                  className={`w-full p-2.5 border rounded-md shadow-sm ${errors.date ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:border-orange-500 focus:ring-orange-500'}`} />
                {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date.message}</p>}
              </div>
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-1">תיאור</label>
              <input type="text" id="description" {...register("description")}
                className="w-full p-2.5 border border-slate-300 rounded-md shadow-sm focus:border-orange-500 focus:ring-orange-500" placeholder="לדוגמה: שכירות" />
            </div>
            <div className="relative">
              <label htmlFor="subcategoryId" className="block text-sm font-medium text-slate-700 mb-1">קטגוריה</label>
              <input
                type="text"
                id="subcategoryId"
                ref={subcategoryInputRef}
                value={subcategorySearch !== '' ? subcategorySearch : (() => {
                  const selected = allExpenseSubcategories.find(sub => sub.id === Number(getValues('subcategoryId')));
                  return selected ? `${selected.name_he || selected.name} (${selected.parentName})` : '';
                })()}
                onFocus={() => setShowSubcategoryDropdown(true)}
                onBlur={() => setTimeout(() => setShowSubcategoryDropdown(false), 200)}
                onChange={e => {
                  setSubcategorySearch(e.target.value);
                  setValue('subcategoryId', '');
                }}
                placeholder="התחל להקליד קטגוריה..."
                className="w-full p-2.5 border border-slate-300 rounded-md bg-white focus:border-orange-500 focus:ring-orange-500"
                autoComplete="off"
              />
              {showSubcategoryDropdown && sortedExpenseSubcategories.length > 0 && (
                <ul className="absolute z-10 w-full bg-white border border-slate-300 rounded-md mt-1 max-h-48 overflow-y-auto shadow-lg">
                  {sortedExpenseSubcategories.map(sub => (
                    <li
                      key={sub.id}
                      className="px-4 py-2 hover:bg-orange-100 cursor-pointer text-sm"
                      onMouseDown={() => {
                        setValue('subcategoryId', sub.id);
                        setSubcategorySearch(`${sub.name_he || sub.name} (${sub.parentName})`);
                        setShowSubcategoryDropdown(false);
                      }}
                    >
                      {sub.name_he || sub.name} <span className="text-xs text-slate-400">({sub.parentName})</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="rec_frequency_edit" className="block text-xs font-medium text-slate-600 mb-1">תדירות*</label>
                <select id="rec_frequency_edit" {...register("rec_frequency", { required: "תדירות היא חובה" })} className={`w-full p-2 border rounded-md shadow-sm bg-white ${errors.rec_frequency ? 'border-red-500' : 'border-slate-300'}`}> 
  {recurringFrequencyOptions.map(opt => <option value={opt.value} key={opt.value}>{opt.label}</option>)}
</select>
                {errors.rec_frequency && <p className="text-xs text-red-500 mt-1">{errors.rec_frequency.message}</p>}
              </div>
              <div>
                <label htmlFor="rec_interval_edit" className="block text-xs font-medium text-slate-600 mb-1">מרווח</label>
                <input type="number" id="rec_interval_edit" {...register("rec_interval", { valueAsNumber: true, min:1, setValueAs: v => parseInt(v) || 1 })} defaultValue={1} className="w-full p-2 border border-slate-300 rounded-md shadow-sm" placeholder="1"/>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="rec_occurrences_edit" className="block text-xs font-medium text-slate-600 mb-1">מספר חזרות</label>
                <input type="number" id="rec_occurrences_edit" {...register("rec_occurrences", { valueAsNumber: true, validate: v => !v || (Number.isInteger(v) && v > 0) || "חייב להיות מספר שלם גדול מ-0" })} className="w-full p-2 border border-slate-300 rounded-md shadow-sm" placeholder="אופציונלי"/>
                {errors.rec_occurrences && <p className="text-xs text-red-500 mt-1">{errors.rec_occurrences.message}</p>}
              </div>
              <div>
                <label htmlFor="rec_endDate_edit" className="block text-xs font-medium text-slate-600 mb-1">תאריך סיום</label>
                <input type="date" id="rec_endDate_edit" {...register("rec_endDate", { validate: v => !v || isValid(parseISO(v)) || "תאריך לא תקין"})} className="w-full p-2 border border-slate-300 rounded-md shadow-sm"/>
                {errors.rec_endDate && <p className="text-xs text-red-500 mt-1">{errors.rec_endDate.message}</p>}
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end space-x-3 pt-4">
          <button type="button" onClick={onCloseAndReset} className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors"><FiXCircle className="inline ml-1 h-4 w-4" /> ביטול</button>
          <button type="submit" disabled={mutation.isLoading || isSubmitting} className="px-5 py-2.5 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center">
            {mutation.isLoading || isSubmitting ? ( 
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                שומר...
              </> 
            ) : ( 
              <>
                <FiSave className="inline ml-1 h-4 w-4" /> {isEditMode ? 'עדכן' : 'שמור'}
              </> 
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AddTransactionModal;