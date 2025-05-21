// frontend/src/components/transactions/AddTransactionModal.jsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Modal from '../ui/Modal';
import { useForm } from 'react-hook-form';
import apiClient from '../../api/apiClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FiSave, FiXCircle } from 'react-icons/fi';
import { format, parseISO, isValid } from 'date-fns';

const fetchCategories = async (type) => {
  if (!type) return []; // Prevent query if type is not set
  const { data } = await apiClient.get(`/categories?type=${type}`);
  return data;
};

const initialDefaultFormValues = {
  amount: '',
  date: format(new Date(), 'yyyy-MM-dd'),
  description: '',
  subcategoryId: '',
  categoryId: '',
  paymentMethod: '',
  expenseTypeOption: 'single',
  incomeTypeOption: 'single',
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
  { value: 'annually', label: 'שנתי' } // Corrected 'yearly' to 'annually' if that's what backend expects
];

const AddTransactionModal = ({ isOpen, onClose, initialType = 'expense', transactionToEdit = null }) => {
  const queryClient = useQueryClient();
  const [transactionType, setTransactionType] = useState(initialType);
  const [formError, setFormError] = useState('');
  const isEditMode = !!transactionToEdit;
  
  // Derived states - these depend on transactionToEdit, so define them early
  const isEditingRecurringIncomeDef = useMemo(() => 
    isEditMode && transactionToEdit && transactionToEdit.editAllRecurring && transactionToEdit.type === 'income',
    [isEditMode, transactionToEdit]
  );
  // Assuming 'isRecurringInstance' might indicate a planned instance of an existing definition
  // and 'editAllRecurring' (passed from parent) indicates editing the definition itself.
  // If 'transactionToEdit.isRecurringInstance' means it IS a definition, adjust logic.
  // For now, I'm assuming 'editAllRecurring' is the flag to edit the definition.

  const isEditingRecurringExpenseDef = useMemo(() => 
    isEditMode && transactionToEdit && transactionToEdit.editAllRecurring && transactionToEdit.type === 'expense',
    [isEditMode, transactionToEdit]
  );

  const isEditingDefinition = isEditingRecurringIncomeDef || isEditingRecurringExpenseDef;


  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
    setValue,
    clearErrors,
    getValues
  } = useForm({
    defaultValues: initialDefaultFormValues
  });

  const watchedExpenseTypeOption = watch("expenseTypeOption");
  const watchedIncomeTypeOption = watch("incomeTypeOption"); // was watchedIsDefiningRecurringIncome

  const [categorySearch, setCategorySearch] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const categoryInputRef = useRef(null);

  const [subcategorySearch, setSubcategorySearch] = useState('');
  const [showSubcategoryDropdown, setShowSubcategoryDropdown] = useState(false);
  const subcategoryInputRef = useRef(null);

  // Fetch categories - MOVED UP & CORRECTED QUERY KEY
  const {
    data: categoriesData, // Renamed to avoid confusion
    isLoading: isLoadingCategories,
    error: categoriesError,
  } = useQuery({
    queryKey: ['modalCategories', transactionType], // CORRECTED: use transactionType from state
    queryFn: () => fetchCategories(transactionType),
    enabled: isOpen && !!transactionType, // Ensure transactionType is set
    staleTime: 1000 * 60 * 5, // Categories don't change often
  });

  // Provide a stable, always-array `categories` for the rest of the component
  const categories = useMemo(() => categoriesData || [], [categoriesData]);

  useEffect(() => {
    // Always set transactionType based on initialType when modal opens or initialType changes
    if (isOpen) {
        setTransactionType(initialType);
    }

    // Form reset and population logic
    if (!isOpen) { // If modal is closed, reset everything
        const resetDate = format(new Date(), "yyyy-MM-dd");
        reset({...initialDefaultFormValues, date: resetDate});
        setCategorySearch('');
        setSubcategorySearch('');
        clearErrors();
        setFormError('');
        return;
    }
    
    // Determine the actual type for reset logic
    const currentTypeForReset = transactionToEdit?.type || initialType;

    // Default reset for add mode or if no specific edit case matches
    let baseResetValues = { 
        ...initialDefaultFormValues, 
        date: format(new Date(), 'yyyy-MM-dd'),
        // Ensure expense/income options are reset based on current type
        expenseTypeOption: currentTypeForReset === 'expense' ? 'single' : initialDefaultFormValues.expenseTypeOption,
        incomeTypeOption: currentTypeForReset === 'income' ? 'single' : initialDefaultFormValues.incomeTypeOption,
    };

    if (isEditingRecurringIncomeDef && transactionToEdit) {
      baseResetValues = {
        amount: transactionToEdit.amount,
        date: transactionToEdit.startDate ? format(parseISO(transactionToEdit.startDate), 'yyyy-MM-dd') : initialDefaultFormValues.date,
        description: transactionToEdit.description?.replace(' (מתוכנן)', '') || '',
        categoryId: transactionToEdit.categoryId || '',
        incomeTypeOption: 'recurring', // Explicitly set for recurring income def edit
        rec_frequency: transactionToEdit.frequency || initialDefaultFormValues.rec_frequency,
        rec_interval: transactionToEdit.interval || initialDefaultFormValues.rec_interval,
        rec_occurrences: transactionToEdit.occurrences || '',
        rec_endDate: transactionToEdit.endDate ? format(parseISO(transactionToEdit.endDate), 'yyyy-MM-dd') : '',
      };
      setTransactionType('income'); // Ensure type is income
      if (!isLoadingCategories && categories.length > 0) {
        const cat = categories.find(c => c.id === Number(transactionToEdit.categoryId));
        setCategorySearch(cat ? (cat.name_he || cat.name || '') : '');
      } else if (!isLoadingCategories) {
        setCategorySearch('');
      }
    } else if (isEditingRecurringExpenseDef && transactionToEdit) {
      baseResetValues = {
        amount: transactionToEdit.amount,
        date: transactionToEdit.startDate ? format(parseISO(transactionToEdit.startDate), 'yyyy-MM-dd') : initialDefaultFormValues.date,
        description: transactionToEdit.description?.replace(' (מתוכנן)', '') || '',
        subcategoryId: transactionToEdit.subcategoryId || '',
        paymentMethod: transactionToEdit.paymentMethod || '',
        expenseTypeOption: 'recurring', // Explicitly set
        rec_frequency: transactionToEdit.frequency || initialDefaultFormValues.rec_frequency,
        rec_interval: transactionToEdit.interval || initialDefaultFormValues.rec_interval,
        rec_occurrences: transactionToEdit.occurrences || '',
        rec_endDate: transactionToEdit.endDate ? format(parseISO(transactionToEdit.endDate), 'yyyy-MM-dd') : '',
      };
      setTransactionType('expense'); // Ensure type is expense
      if (!isLoadingCategories && categories.length > 0) {
        const allSubs = categories.filter(c => c.type === 'expense').flatMap(c => c.subcategories || []);
        const sub = allSubs.find(s => s.id === Number(transactionToEdit.subcategoryId));
        if (sub) {
            const parentCat = categories.find(c => c.id === sub.categoryId);
            setSubcategorySearch(sub ? `${sub.name_he || sub.name} (${parentCat?.name_he || parentCat?.name || ''})` : '');
        } else {
            setSubcategorySearch('');
        }
      } else if (!isLoadingCategories) {
        setSubcategorySearch('');
      }
    } else if (isEditMode && transactionToEdit) {
      const currentTxType = transactionToEdit.type || (transactionToEdit.isExpense ? 'expense' : 'income');
      setTransactionType(currentTxType); // Set transaction type based on editing item

      const subId = transactionToEdit.subcategory?.id || transactionToEdit.subcategoryId || '';
      const catId = transactionToEdit.category?.id || transactionToEdit.categoryId || '';
      baseResetValues = {
        amount: transactionToEdit.amount,
        date: transactionToEdit.date ? format(parseISO(transactionToEdit.date), 'yyyy-MM-dd') : initialDefaultFormValues.date,
        description: transactionToEdit.description || '',
        subcategoryId: currentTxType === 'expense' ? subId : '',
        categoryId: currentTxType === 'income' ? catId : '',
        paymentMethod: transactionToEdit.paymentMethod || '',
        expenseTypeOption: currentTxType === 'expense' ? (transactionToEdit.expenseType || 'single') : 'single',
        incomeTypeOption: currentTxType === 'income' ? (transactionToEdit.incomeTypeOption || 'single') : 'single',
        isProcessed: transactionToEdit.isProcessed !== undefined ? transactionToEdit.isProcessed : true,
      };
      
      if (currentTxType === 'income') {
        if (!isLoadingCategories && categories.length > 0) {
          const cat = categories.find(c => c.id === Number(catId));
          setCategorySearch(cat ? (cat.name_he || cat.name || '') : '');
        } else if (!isLoadingCategories) { // Categories loaded, but item not found or no categories
          setCategorySearch('');
        }
      } else if (currentTxType === 'expense') {
         if (!isLoadingCategories && categories.length > 0) {
            const allSubs = categories.filter(c => c.type === 'expense').flatMap(c => c.subcategories || []);
            const sub = allSubs.find(s => s.id === Number(subId));
             if (sub) {
                const parentCat = categories.find(c => c.id === sub.categoryId);
                setSubcategorySearch(sub ? `${sub.name_he || sub.name} (${parentCat?.name_he || parentCat?.name || ''})` : '');
            } else {
                setSubcategorySearch('');
            }
         } else if (!isLoadingCategories) {
            setSubcategorySearch('');
         }
      }
    } else { // Add mode
        setTransactionType(initialType); // Ensure type is set for add mode
        // baseResetValues is already set for add mode
        setCategorySearch('');
        setSubcategorySearch('');
    }
    reset(baseResetValues); // Apply the determined reset values

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isOpen, 
    transactionToEdit, 
    initialType, 
    // No 'categories' here directly, loading state handles re-runs for search
    isLoadingCategories, // Re-run when categories finish loading to set search terms
    // reset, clearErrors, setFormError are stable from RHF & useState
    // isEditMode, isEditingRecurringIncomeDef, isEditingRecurringExpenseDef are derived and stable per render cycle
    // setTransactionType, setCategorySearch, setSubcategorySearch are stable setters
  ]);
  
  // This separate effect handles re-setting search terms if categories data changes *after* initial load
  useEffect(() => {
    if (isOpen && !isLoadingCategories && categories.length > 0) {
        if (isEditingRecurringIncomeDef && transactionToEdit && transactionType === 'income') {
            const cat = categories.find(c => c.id === Number(transactionToEdit.categoryId));
            setCategorySearch(cat ? (cat.name_he || cat.name || '') : (getValues('categoryId') ? 'קטגוריה נטענה' : ''));
        } else if (isEditingRecurringExpenseDef && transactionToEdit && transactionType === 'expense') {
            const allSubs = categories.filter(c => c.type === 'expense').flatMap(c => c.subcategories || []);
            const sub = allSubs.find(s => s.id === Number(transactionToEdit.subcategoryId));
            if (sub) {
                const parentCat = categories.find(c => c.id === sub.categoryId);
                setSubcategorySearch(sub ? `${sub.name_he || sub.name} (${parentCat?.name_he || parentCat?.name || ''})` : (getValues('subcategoryId') ? 'קטגוריה נטענה' : ''));
            }
        } else if (isEditMode && transactionToEdit) {
            const currentTxType = transactionToEdit.type || (transactionToEdit.isExpense ? 'expense' : 'income');
            if (currentTxType === 'income' && transactionType === 'income') {
                const catId = transactionToEdit.category?.id || transactionToEdit.categoryId || '';
                const cat = categories.find(c => c.id === Number(catId));
                setCategorySearch(cat ? (cat.name_he || cat.name || '') : (getValues('categoryId') ? 'קטגוריה נטענה' : ''));
            } else if (currentTxType === 'expense' && transactionType === 'expense') {
                const subId = transactionToEdit.subcategory?.id || transactionToEdit.subcategoryId || '';
                const allSubs = categories.filter(c => c.type === 'expense').flatMap(c => c.subcategories || []);
                const sub = allSubs.find(s => s.id === Number(subId));
                if (sub) {
                    const parentCat = categories.find(c => c.id === sub.categoryId);
                    setSubcategorySearch(sub ? `${sub.name_he || sub.name} (${parentCat?.name_he || parentCat?.name || ''})` : (getValues('subcategoryId') ? 'קטגוריה נטענה' : ''));
                }
            }
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, isLoadingCategories, isOpen, transactionToEdit, isEditMode, isEditingRecurringIncomeDef, isEditingRecurringExpenseDef, transactionType /*getValues should be stable*/]);


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
      queryClient.invalidateQueries({ queryKey: ['recurring-income-definitions'] });
      queryClient.invalidateQueries({ queryKey: ['recurring-definitions'] }); // For expenses
      ['dashboardSummary', 'recentTransactions', 'expenseDistribution'].forEach(key =>
        queryClient.invalidateQueries({ queryKey: [key], exact: false }) // Changed to false for broader match
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
    setFormError('');

    const parsedAmount = parseFloat(data.amount);
     // For recurring definitions (income or expense) or installment definitions, the main 'amount' field might not be the primary amount.
    // The 'amount' for a single instance or edit is validated.
    if (!isEditingDefinition && // Not editing a definition
        !(transactionType === 'income' && data.incomeTypeOption === 'recurring') && // Not defining new recurring income
        !(transactionType === 'expense' && (data.expenseTypeOption === 'recurring' || data.expenseTypeOption === 'installment')) && // Not defining new recurring/installment expense
        (isNaN(parsedAmount) || parsedAmount <= 0) // Then, amount must be valid
    ) {
        setFormError("הסכום שהוזן אינו תקין או חסר.");
        return;
    }

    if (!data.date || !isValid(parseISO(data.date))) {
      setFormError("התאריך שהוזן אינו תקין או חסר.");
      return;
    }

    let payload = {};
    let endpoint = '';
    let method = (isEditMode && transactionToEdit?.id && !transactionToEdit.editAllRecurring && !isEditingDefinition) ? 'put' : 'post';
    // If we are editing a definition (isEditingDefinition is true), it's often a PUT to definition's ID.
    // If transactionToEdit.editAllRecurring is true, it implies editing the definition.

    if (isEditingDefinition && transactionToEdit?.recurringDefinitionId) {
        method = 'put'; // Definitely PUT for definitions
    }


    if (transactionType === 'income') {
      const incomeType = isEditMode ? (transactionToEdit?.incomeTypeOption || (isEditingRecurringIncomeDef ? 'recurring' : 'single')) : data.incomeTypeOption;

      if (incomeType === 'recurring' && (isEditingRecurringIncomeDef || !isEditMode)) {
        method = isEditingRecurringIncomeDef ? 'put' : 'post';
        endpoint = isEditingRecurringIncomeDef
          ? `/recurring-income-definitions/${transactionToEdit.recurringDefinitionId || transactionToEdit.id}`
          : '/recurring-income-definitions';
        payload = {
          amount: parsedAmount,
          startDate: format(parseISO(data.date), 'yyyy-MM-dd'),
          description: data.description || null,
          categoryId: data.categoryId ? parseInt(data.categoryId, 10) : undefined,
          frequency: data.rec_frequency,
          interval: data.rec_interval ? parseInt(data.rec_interval, 10) : 1,
        };
        if (isEditingRecurringIncomeDef) payload.isActive = transactionToEdit.isActive !== undefined ? transactionToEdit.isActive : true;
        if (data.rec_occurrences) payload.occurrences = parseInt(data.rec_occurrences, 10);
        if (data.rec_endDate && isValid(parseISO(data.rec_endDate))) payload.endDate = format(parseISO(data.rec_endDate), 'yyyy-MM-dd');
      } else { // Single income (add or edit instance)
        method = isEditMode ? 'put' : 'post';
        endpoint = isEditMode ? `/incomes/${transactionToEdit.id}` : '/incomes';
        payload = {
          amount: parsedAmount,
          date: format(parseISO(data.date), 'yyyy-MM-dd'),
          description: data.description || null,
          categoryId: data.categoryId ? parseInt(data.categoryId, 10) : undefined,
        };
        if (isEditMode && transactionToEdit?.parentId) payload.recurringDefinitionId = transactionToEdit.parentId; // or recurringDefinitionId
      }
    } else { // Expense
      const expenseType = isEditMode ? (transactionToEdit?.expenseType || (isEditingRecurringExpenseDef ? 'recurring' : 'single')) : data.expenseTypeOption;
      
      if (!isEditMode && !data.subcategoryId && expenseType !== 'installment' && expenseType !== 'recurring') {
        setFormError("יש לבחור קטגוריה להוצאה."); // For single expense
        return;
      }
      if ((expenseType === 'recurring' || expenseType === 'installment') && !isEditMode && !data.subcategoryId){
         setFormError("יש לבחור קטגוריה עבור הגדרת ההוצאה.");
         return;
      }


      if (expenseType === 'recurring' && (isEditingRecurringExpenseDef || !isEditMode)) {
        method = isEditingRecurringExpenseDef ? 'put' : 'post';
        endpoint = isEditingRecurringExpenseDef
          ? `/recurring-definitions/${transactionToEdit.recurringDefinitionId || transactionToEdit.id}` // For expenses
          : '/recurring-definitions';
        payload = {
          amount: parsedAmount,
          startDate: format(parseISO(data.date), 'yyyy-MM-dd'),
          description: data.description || null,
          subcategoryId: data.subcategoryId ? parseInt(data.subcategoryId, 10) : undefined,
          paymentMethod: data.paymentMethod || null,
          frequency: data.rec_frequency,
          interval: data.rec_interval ? parseInt(data.rec_interval, 10) : 1,
        };
        if (isEditingRecurringExpenseDef) payload.isActive = transactionToEdit.isActive !== undefined ? transactionToEdit.isActive : true;
        if (data.rec_occurrences) payload.occurrences = parseInt(data.rec_occurrences, 10);
        if (data.rec_endDate && isValid(parseISO(data.rec_endDate))) payload.endDate = format(parseISO(data.rec_endDate), 'yyyy-MM-dd');
      } else if (expenseType === 'installment' && !isEditMode) { // Only new installment definitions
        method = 'post';
        endpoint = '/installment-transactions';
        const totalAmount = parseFloat(data.inst_totalAmount);
        const numberOfInstallments = data.inst_numberOfInstallments ? parseInt(data.inst_numberOfInstallments, 10) : undefined;
        if (!totalAmount || totalAmount <= 0) { setFormError("סכום עסקה כולל חסר או לא תקין."); return; }
        if (!numberOfInstallments || numberOfInstallments < 2) { setFormError("מספר תשלומים חסר או לא תקין."); return; }
        payload = {
          totalAmount,
          numberOfInstallments,
          firstPaymentDate: format(parseISO(data.date), 'yyyy-MM-dd'),
          description: data.description || null,
          subcategoryId: data.subcategoryId ? parseInt(data.subcategoryId, 10) : undefined,
          paymentMethod: data.paymentMethod || null,
        };
      } else { // Single expense (add or edit instance)
        method = isEditMode ? 'put' : 'post';
        endpoint = isEditMode ? `/expenses/${transactionToEdit.id}` : '/expenses';
        payload = {
          amount: parsedAmount,
          date: format(parseISO(data.date), 'yyyy-MM-dd'),
          description: data.description || null,
          subcategoryId: data.subcategoryId ? parseInt(data.subcategoryId, 10) : undefined,
          paymentMethod: data.paymentMethod || null,
          isProcessed: data.isProcessed !== undefined ? data.isProcessed : true, // Default to true for new/edited single
          expenseType: 'single', // Ensure backend gets this for single
        };
        if (isEditMode && transactionToEdit?.expenseType) payload.expenseType = transactionToEdit.expenseType; // Preserve original type if editing instance
        if (isEditMode && transactionToEdit?.parentId) payload.parentId = transactionToEdit.parentId;
      }
    }

    if (!endpoint) {
      setFormError("לא ניתן לקבוע את נקודת הקצה לשליחה. בדוק את סוג הפעולה.");
      return;
    }
    mutation.mutate({ method, endpoint, payload });
  };

  const onCloseAndReset = useCallback(() => {
    const resetDate = format(new Date(), "yyyy-MM-dd");
    // Pass initialType to reset transactionType correctly for next opening
    setTransactionType(initialType); 
    reset({ ...initialDefaultFormValues, date: resetDate });
    setCategorySearch('');
    setSubcategorySearch('');
    setFormError('');
    clearErrors();
    onClose();
  }, [reset, initialType, onClose, clearErrors, setTransactionType]);

  useEffect(() => {
    if (!isEditMode && isOpen) { // Only in add mode and when modal is open
      const currentValues = getValues();
      const newValuesToSet = {};
      let changed = false;

      const resetRecurringFields = () => {
        if (currentValues.rec_frequency !== initialDefaultFormValues.rec_frequency) { newValuesToSet.rec_frequency = initialDefaultFormValues.rec_frequency; changed = true; }
        if (currentValues.rec_interval !== initialDefaultFormValues.rec_interval) { newValuesToSet.rec_interval = initialDefaultFormValues.rec_interval; changed = true; }
        if (currentValues.rec_occurrences !== initialDefaultFormValues.rec_occurrences) { newValuesToSet.rec_occurrences = initialDefaultFormValues.rec_occurrences; changed = true; }
        if (currentValues.rec_endDate !== initialDefaultFormValues.rec_endDate) { newValuesToSet.rec_endDate = initialDefaultFormValues.rec_endDate; changed = true; }
      };
      
      const resetInstallmentFields = () => {
         if (currentValues.inst_totalAmount !== initialDefaultFormValues.inst_totalAmount) { newValuesToSet.inst_totalAmount = initialDefaultFormValues.inst_totalAmount; changed = true; }
         if (currentValues.inst_numberOfInstallments !== initialDefaultFormValues.inst_numberOfInstallments) { newValuesToSet.inst_numberOfInstallments = initialDefaultFormValues.inst_numberOfInstallments; changed = true; }
      };

      if (transactionType === 'expense') {
        if (watchedExpenseTypeOption !== 'recurring') resetRecurringFields();
        if (watchedExpenseTypeOption !== 'installment') resetInstallmentFields();
        // Ensure income-specific options are reset if switching to expense
        if (currentValues.incomeTypeOption !== initialDefaultFormValues.incomeTypeOption) { newValuesToSet.incomeTypeOption = initialDefaultFormValues.incomeTypeOption; changed = true;}
      } else if (transactionType === 'income') {
        if (watchedIncomeTypeOption !== 'recurring') resetRecurringFields();
        // Ensure expense-specific options are reset if switching to income
        if (currentValues.expenseTypeOption !== initialDefaultFormValues.expenseTypeOption) { newValuesToSet.expenseTypeOption = initialDefaultFormValues.expenseTypeOption; changed = true; }
        resetInstallmentFields(); // Income doesn't have installments
      }

      if (changed) {
        Object.entries(newValuesToSet).forEach(([key, value]) => {
          setValue(key, value, { shouldValidate: false, shouldDirty: false });
        });
      }
    }
  }, [watchedExpenseTypeOption, watchedIncomeTypeOption, transactionType, isEditMode, setValue, getValues, isOpen, initialDefaultFormValues]);


  const sortedIncomeCategories = useMemo(() => {
    if (isLoadingCategories || !categories || transactionType !== 'income') return [];
    let cats = categories.filter(cat => cat.type === 'income'); // Should already be filtered by query
    cats = cats.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0) || (a.name_he || a.name).localeCompare(b.name_he || b.name));
    if (categorySearch) {
      const search = categorySearch.toLowerCase();
      cats = cats.filter(cat => (cat.name_he || cat.name || '').toLowerCase().includes(search));
    }
    return cats;
  }, [categories, isLoadingCategories, transactionType, categorySearch]);

  const allExpenseSubcategories = useMemo(() => {
    if (isLoadingCategories || !categories || transactionType !== 'expense') return [];
    return categories
      .filter(cat => cat.type === 'expense' && cat.subcategories && cat.subcategories.length > 0)
      .flatMap(cat =>
        (cat.subcategories || []).map(sub => ({
          ...sub,
          parentName: cat.name_he || cat.name,
          parentUsage: cat.usageCount || 0,
          categoryId: cat.id // Ensure subcategory has its parent categoryId
        }))
      );
  }, [categories, isLoadingCategories, transactionType]);

  const sortedExpenseSubcategories = useMemo(() => {
    let subs = allExpenseSubcategories;
    if (subcategorySearch) {
      const search = subcategorySearch.toLowerCase();
      subs = subs.filter(sub =>
        (sub.name_he || sub.name || '').toLowerCase().includes(search) ||
        (sub.parentName || '').toLowerCase().includes(search)
      );
    }
    return subs.sort((a, b) =>
      (b.usageCount || 0) - (a.usageCount || 0) ||
      (b.parentUsage || 0) - (a.parentUsage || 0) ||
      (a.name_he || a.name || '').localeCompare(b.name_he || b.name || '')
    );
  }, [allExpenseSubcategories, subcategorySearch]);


  // --- UI Rendering ---
  // Conditional rendering for category/subcategory fields based on loading state
  const categoryInputPlaceholder = isLoadingCategories ? "טוען קטגוריות..." : "התחל להקליד קטגוריה...";
  const categoryInputDisabled = isLoadingCategories;

  if (!isOpen) return null; // Don't render anything if not open

  return (
    <Modal isOpen={isOpen} onClose={onCloseAndReset} title={isEditMode ? `עריכת ${transactionType === 'expense' ? 'הוצאה' : 'הכנסה'}` : `הוספת ${transactionType === 'expense' ? 'הוצאה' : 'הכנסה'}`} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Type Toggle: Expense/Income (only in add mode) */}
        {!isEditMode && (
            <div className="flex border border-slate-300 rounded-md p-1 bg-slate-50 max-w-xs mx-auto mb-2">
            <button type="button" onClick={() => { 
                setTransactionType('expense'); 
                // Full reset when switching main type to ensure correct options appear
                const resetDate = format(new Date(), "yyyy-MM-dd");
                reset({...initialDefaultFormValues, date: resetDate, incomeTypeOption: 'single', expenseTypeOption: 'single'});
                clearErrors(); 
                setCategorySearch(''); setSubcategorySearch('');
            }}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${transactionType === 'expense' ? 'bg-red-500 text-white shadow-md' : 'text-slate-600 hover:bg-red-100'}`}>הוצאה</button>
            <button type="button" onClick={() => { 
                setTransactionType('income'); 
                const resetDate = format(new Date(), "yyyy-MM-dd");
                reset({...initialDefaultFormValues, date: resetDate, incomeTypeOption: 'single', expenseTypeOption: 'single'});
                clearErrors(); 
                setCategorySearch(''); setSubcategorySearch('');
            }}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${transactionType === 'income' ? 'bg-green-500 text-white shadow-md' : 'text-slate-600 hover:bg-green-100'}`}>הכנסה</button>
            </div>
        )}

        {/* Sub-Type Toggle for Income (Single/Recurring) - Add mode or if not editing a definition */}
        {transactionType === 'income' && (!isEditMode || (isEditMode && !isEditingRecurringIncomeDef)) && (
          <div className="flex border border-green-300 rounded-md p-1 bg-green-50 max-w-xs mx-auto mb-2">
            {['single', 'recurring'].map(type => (
              <button
                key={type}
                type="button"
                onClick={() => {
                    if (isEditMode && type === 'recurring') return; // Prevent switching to recurring definition edit from single edit
                    setValue('incomeTypeOption', type);
                }}
                disabled={isEditMode && type === 'recurring' && !isEditingRecurringIncomeDef} // Disable if editing single, don't allow switch to "define recurring"
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${watchedIncomeTypeOption === type ? 'bg-green-500 text-white shadow-md' : 'text-slate-600 hover:bg-green-100'} ${isEditMode && type === 'recurring' && !isEditingRecurringIncomeDef ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {type === 'single' ? 'חד פעמית' : 'הגדרת הכנסה חוזרת'}
              </button>
            ))}
          </div>
        )}
        
        {/* Sub-Type Toggle for Expense (Single/Recurring/Installment) - Add mode or if not editing a definition */}
        {transactionType === 'expense' && (!isEditMode || (isEditMode && !isEditingRecurringExpenseDef)) && (
          <div className="flex border border-red-300 rounded-md p-1 bg-red-50 max-w-xs mx-auto mb-2">
            {['single', 'recurring', 'installment'].map(type => (
              <button key={type} type="button" onClick={() => {
                    if (isEditMode && (type === 'recurring' || type === 'installment')) return; // Prevent switching
                    setValue("expenseTypeOption", type)
                }}
                disabled={isEditMode && (type === 'recurring' || type === 'installment') && !isEditingRecurringExpenseDef}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${watchedExpenseTypeOption === type ? (type === 'single' ? 'bg-red-500 text-white shadow-md' : type === 'recurring' ? 'bg-orange-500 text-white shadow-md' : 'bg-teal-500 text-white shadow-md') : 'text-slate-600 hover:bg-red-100'} ${isEditMode && (type === 'recurring' || type === 'installment') && !isEditingRecurringExpenseDef ? 'opacity-50 cursor-not-allowed' : ''}`}>
                {type === 'single' ? 'חד פעמית' : type === 'recurring' ? 'הגדרת הוצאה חוזרת' : 'הגדרת תשלומים'}
              </button>
            ))}
          </div>
        )}

        {formError && <p className="text-sm text-red-600 bg-red-100 p-3 rounded-md text-center">{formError}</p>}
        {categoriesError && <p className="text-sm text-red-600 bg-red-100 p-3 rounded-md text-center">שגיאה בטעינת קטגוריות: {categoriesError.message}</p>}


        {/* Common Fields: Amount, Date, Description */}
        {/* Show these fields unless we are editing a recurring definition of type 'installment' where 'amount' is not the primary */}
        { !(isEditingDefinition && transactionToEdit?.expenseType === 'installment') && (
            <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="amount" className="block text-sm font-medium text-slate-700 mb-1">
                    סכום*
                    {(transactionType === 'income' && watchedIncomeTypeOption === 'recurring') || (transactionType === 'expense' && watchedExpenseTypeOption === 'recurring') ? ' (לכל מופע)' : ''}
                </label>
                <input type="number" id="amount" step="0.01" {...register("amount", { 
                    required: "סכום הוא שדה חובה", // Required for all types including definitions
                    valueAsNumber: true, 
                    validate: value => (value !== undefined && value !== null && value > 0) || "הסכום חייב להיות חיובי" 
                  })}
                  className={`w-full p-2.5 border rounded-md shadow-sm ${errors.amount ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:border-sky-500 focus:ring-sky-500'}`} placeholder="0.00" />
                {errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount.message}</p>}
              </div>
              <div>
                <label htmlFor="date" className="block text-sm font-medium text-slate-700 mb-1">
                  תאריך*
                  {transactionType === 'expense' && !isEditMode && watchedExpenseTypeOption === 'recurring' ? ' (ת.התחלה)' : ''}
                  {transactionType === 'expense' && !isEditMode && watchedExpenseTypeOption === 'installment' ? ' (ת.תשלום 1)' : ''}
                  {transactionType === 'income' && !isEditMode && watchedIncomeTypeOption === 'recurring' ? ' (ת.התחלה)' : ''}
                  {(isEditingRecurringIncomeDef || isEditingRecurringExpenseDef) ? ' (ת.התחלה)' : ''}
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


        {/* --- INCOME FIELDS --- */}
        {transactionType === 'income' && (
          <>
            {/* Category for Income (all income types: single, recurring definition, editing recurring def) */}
            <div>
              <label htmlFor="incomeCategoryId" className="block text-sm font-medium text-slate-700 mb-1">קטגוריית הכנסה</label>
              <div className="relative">
                <input
                  type="text"
                  id="incomeCategoryId" // Unique ID
                  ref={categoryInputRef}
                  value={categorySearch}
                  onFocus={() => setShowCategoryDropdown(true)}
                  onBlur={() => setTimeout(() => setShowCategoryDropdown(false), 200)}
                  onChange={e => {
                    setCategorySearch(e.target.value);
                    setValue('categoryId', ''); // Clear hidden value on manual text change
                  }}
                  placeholder={categoryInputPlaceholder}
                  disabled={categoryInputDisabled}
                  className="w-full p-2.5 border border-slate-300 rounded-md bg-white focus:border-sky-500 focus:ring-sky-500"
                  autoComplete="off"
                />
                {showCategoryDropdown && sortedIncomeCategories.length > 0 && (
                  <ul className="absolute z-20 w-full bg-white border border-slate-300 rounded-md mt-1 max-h-48 overflow-y-auto shadow-lg">
                    {sortedIncomeCategories.map(cat => (
                      <li
                        key={cat.id}
                        className="px-4 py-2 hover:bg-sky-100 cursor-pointer text-sm"
                        onMouseDown={() => { // Use onMouseDown to fire before onBlur
                          setValue('categoryId', cat.id);
                          setCategorySearch(cat.name_he || cat.name);
                          setShowCategoryDropdown(false);
                          clearErrors('categoryId');
                        }}
                      >
                        {cat.name_he || cat.name}
                      </li>
                    ))}
                  </ul>
                )}
                {showCategoryDropdown && !isLoadingCategories && sortedIncomeCategories.length === 0 && categorySearch && (
                    <div className="absolute z-20 w-full bg-white border border-slate-300 rounded-md mt-1 p-2 text-sm text-slate-500 shadow-lg">אין קטגוריות תואמות</div>
                )}
              </div>
               {errors.categoryId && <p className="text-xs text-red-500 mt-1">{errors.categoryId.message}</p>}
            </div>

            {/* Recurring Income Fields (for defining new or editing definition) */}
            {(watchedIncomeTypeOption === 'recurring' || isEditingRecurringIncomeDef) && (
              <div className="p-3 mt-3 border border-green-200 rounded-md bg-green-50 space-y-4">
                <h4 className="text-md font-medium text-green-700">
                    {isEditingRecurringIncomeDef ? 'עריכת פרטי הכנסה חוזרת' : 'פרטי הגדרת הכנסה חוזרת'}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label htmlFor="rec_frequency_inc" className="block text-xs font-medium text-slate-600 mb-1">תדירות*</label><select id="rec_frequency_inc" {...register("rec_frequency", { required: "תדירות היא חובה" })} className={`w-full p-2 border rounded-md shadow-sm bg-white ${errors.rec_frequency ? 'border-red-500' : 'border-slate-300'}`}><option value="monthly">חודשי</option><option value="annually">שנתי</option></select>{errors.rec_frequency && <p className="text-xs text-red-500 mt-1">{errors.rec_frequency.message}</p>}</div>
                  <div><label htmlFor="rec_interval_inc" className="block text-xs font-medium text-slate-600 mb-1">מרווח (כל X תדירויות)</label><input type="number" id="rec_interval_inc" {...register("rec_interval", { valueAsNumber: true, min:1, setValueAs: v => parseInt(v) || 1 })} className="w-full p-2 border border-slate-300 rounded-md shadow-sm" placeholder="1"/></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label htmlFor="rec_occurrences_inc" className="block text-xs font-medium text-slate-600 mb-1">מספר חזרות</label><input type="number" id="rec_occurrences_inc" {...register("rec_occurrences", { valueAsNumber: true, validate: v => !v || v === '' || (Number.isInteger(v) && v > 0) || "חייב להיות מספר שלם גדול מ-0" })} className="w-full p-2 border border-slate-300 rounded-md shadow-sm" placeholder="אופציונלי"/>{errors.rec_occurrences && <p className="text-xs text-red-500 mt-1">{errors.rec_occurrences.message}</p>}</div>
                  <div><label htmlFor="rec_endDate_inc" className="block text-xs font-medium text-slate-600 mb-1">תאריך סיום</label><input type="date" id="rec_endDate_inc" {...register("rec_endDate", { validate: v => !v || v === '' || isValid(parseISO(v)) || "תאריך לא תקין"})} className="w-full p-2 border border-slate-300 rounded-md shadow-sm"/>{errors.rec_endDate && <p className="text-xs text-red-500 mt-1">{errors.rec_endDate.message}</p>}</div>
                </div>
              </div>
            )}
          </>
        )}

        {/* --- EXPENSE FIELDS --- */}
        {transactionType === 'expense' && (
          <>
            {/* Category for Expense (all expense types) */}
            <div>
              <label htmlFor="expenseSubcategoryId" className="block text-sm font-medium text-slate-700 mb-1">קטגוריה*</label>
              <div className="relative">
                <input
                  type="text"
                  id="expenseSubcategoryId" // Unique ID
                  ref={subcategoryInputRef}
                  value={subcategorySearch}
                  onFocus={() => setShowSubcategoryDropdown(true)}
                  onBlur={() => setTimeout(() => setShowSubcategoryDropdown(false), 200)}
                  onChange={e => {
                    setSubcategorySearch(e.target.value);
                    setValue('subcategoryId', '');
                  }}
                  placeholder={categoryInputPlaceholder}
                  disabled={categoryInputDisabled}
                  className={`w-full p-2.5 border rounded-md bg-white focus:border-sky-500 focus:ring-sky-500 ${errors.subcategoryId ? 'border-red-500 focus:ring-red-500' : 'border-slate-300'}`}
                  autoComplete="off"
                />
                {showSubcategoryDropdown && sortedExpenseSubcategories.length > 0 && (
                  <ul className="absolute z-20 w-full bg-white border border-slate-300 rounded-md mt-1 max-h-48 overflow-y-auto shadow-lg">
                    {sortedExpenseSubcategories.map(sub => (
                      <li
                        key={sub.id}
                        className="px-4 py-2 hover:bg-sky-100 cursor-pointer text-sm"
                        onMouseDown={() => {
                          setValue('subcategoryId', sub.id);
                          setSubcategorySearch(`${sub.name_he || sub.name} (${sub.parentName})`);
                          setShowSubcategoryDropdown(false);
                          clearErrors('subcategoryId');
                        }}
                      >
                        {sub.name_he || sub.name} <span className="text-xs text-slate-400">({sub.parentName})</span>
                      </li>
                    ))}
                  </ul>
                )}
                {showSubcategoryDropdown && !isLoadingCategories && sortedExpenseSubcategories.length === 0 && subcategorySearch && (
                    <div className="absolute z-20 w-full bg-white border border-slate-300 rounded-md mt-1 p-2 text-sm text-slate-500 shadow-lg">אין קטגוריות תואמות</div>
                )}
              </div>
              {errors.subcategoryId && <p className="text-xs text-red-500 mt-1">{errors.subcategoryId.message}</p>}
            </div>
            <div>
              <label htmlFor="paymentMethod" className="block text-sm font-medium text-slate-700 mb-1">אמצעי תשלום</label>
              <input type="text" id="paymentMethod" {...register("paymentMethod")}
                className="w-full p-2.5 border border-slate-300 rounded-md shadow-sm focus:border-sky-500 focus:ring-sky-500" placeholder="לדוגמה: אשראי" />
            </div>

            {/* Recurring Expense Fields (for defining new or editing definition) */}
            {(watchedExpenseTypeOption === 'recurring' || isEditingRecurringExpenseDef) && (
              <div className="p-3 mt-3 border border-orange-200 rounded-md bg-orange-50 space-y-4">
                <h4 className="text-md font-medium text-orange-700">
                    {isEditingRecurringExpenseDef ? 'עריכת פרטי הוצאה חוזרת' : 'פרטי הגדרת הוצאה חוזרת'}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="rec_frequency_exp" className="block text-xs font-medium text-slate-600 mb-1">תדירות*</label>
                    <select id="rec_frequency_exp" {...register("rec_frequency", { required: "תדירות היא חובה" })} className={`w-full p-2 border rounded-md shadow-sm bg-white ${errors.rec_frequency ? 'border-red-500' : 'border-slate-300'}`}>
                        <option value="monthly">חודשי</option>
                        <option value="annually">שנתי</option>
                    </select>
                    {errors.rec_frequency && <p className="text-xs text-red-500 mt-1">{errors.rec_frequency.message}</p>}
                  </div>
                  <div>
                    <label htmlFor="rec_interval_exp" className="block text-xs font-medium text-slate-600 mb-1">מרווח (כל X תדירויות)</label>
                    <input type="number" id="rec_interval_exp" {...register("rec_interval", { valueAsNumber: true, min: { value: 1, message: "המרווח חייב להיות גדול מ-0" },validate: { isInteger: v => Number.isInteger(v) || "המרווח חייב להיות מספר שלם"}, setValueAs: v => parseInt(v) || 1 })} className="w-full p-2 border border-slate-300 rounded-md shadow-sm" placeholder="1"/>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="rec_occurrences_exp" className="block text-xs font-medium text-slate-600 mb-1">מספר חזרות</label>
                    <input type="number" id="rec_occurrences_exp" {...register("rec_occurrences", { valueAsNumber: true, validate: v => !v || v === '' || (Number.isInteger(v) && v > 0) || "חייב להיות מספר שלם גדול מ-0" })} className="w-full p-2 border border-slate-300 rounded-md shadow-sm" placeholder="אופציונלי"/>
                    {errors.rec_occurrences && <p className="text-xs text-red-500 mt-1">{errors.rec_occurrences.message}</p>}
                  </div>
                  <div>
                    <label htmlFor="rec_endDate_exp" className="block text-xs font-medium text-slate-600 mb-1">תאריך סיום</label>
                    <input type="date" id="rec_endDate_exp" {...register("rec_endDate", { validate: v => !v || v === '' || isValid(parseISO(v)) || "תאריך לא תקין"})} className="w-full p-2 border border-slate-300 rounded-md shadow-sm"/>
                    {errors.rec_endDate && <p className="text-xs text-red-500 mt-1">{errors.rec_endDate.message}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* Installment Expense Fields (only for defining new) */}
            {watchedExpenseTypeOption === 'installment' && !isEditMode && (
              <div className="p-3 mt-3 border border-teal-200 rounded-md bg-teal-50 space-y-4">
                <h4 className="text-md font-medium text-teal-700">פרטי הגדרת עסקת תשלומים</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label htmlFor="inst_totalAmount" className="block text-xs font-medium text-slate-600 mb-1">סכום עסקה כולל*</label><input type="number" id="inst_totalAmount" step="0.01" {...register("inst_totalAmount", { required: "סכום כולל הוא חובה", valueAsNumber: true, validate: v => (v !== undefined && v !== null && v > 0) || "חייב להיות חיובי" })} className={`w-full p-2 border rounded-md shadow-sm ${errors.inst_totalAmount ? 'border-red-500' : 'border-slate-300'}`} placeholder="0.00"/>{errors.inst_totalAmount && <p className="text-xs text-red-500 mt-1">{errors.inst_totalAmount.message}</p>}</div><div><label htmlFor="inst_numberOfInstallments" className="block text-xs font-medium text-slate-600 mb-1">מספר תשלומים*</label><input type="number" id="inst_numberOfInstallments" {...register("inst_numberOfInstallments", { required: "מספר תשלומים הוא חובה", valueAsNumber: true, min: { value: 2, message: "לפחות 2 תשלומים"} })} className={`w-full p-2 border rounded-md shadow-sm ${errors.inst_numberOfInstallments ? 'border-red-500' : 'border-slate-300'}`} placeholder="לדוגמה: 12"/>{errors.inst_numberOfInstallments && <p className="text-xs text-red-500 mt-1">{errors.inst_numberOfInstallments.message}</p>}</div></div>
              </div>
            )}
          </>
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