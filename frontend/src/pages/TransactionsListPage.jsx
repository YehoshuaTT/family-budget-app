import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import apiClient from '../api/apiClient'; // ודא שהנתיב נכון
import { format, parseISO, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { he } from 'date-fns/locale';
import { 
    FiEdit, FiTrash2, FiRotateCcw, FiFilter, FiCalendar, FiDollarSign, 
    FiCreditCard, FiAlertTriangle, FiPlusCircle, FiRepeat, FiCheckSquare, 
    FiSquare, FiChevronDown, FiSearch, FiRefreshCw, FiArrowUp, FiArrowDown
} from 'react-icons/fi';
import AddTransactionModal from '../components/transactions/AddTransactionModal'; // ודא שהנתיב נכון
import { useAuth } from '../contexts/AuthContext'; // אם תרצה לגשת ל-user settings דרכו
import Modal from 'react-modal'; // ודא שיש לך את הספריה, או תחליף בפתרון modal אחר

// Helper function to format currency
const formatCurrency = (amount, currency = '₪') => {
    if (amount === null || amount === undefined || isNaN(parseFloat(amount))) return `0.00 ${currency}`;
    return `${parseFloat(amount).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
};

const SkeletonRow = () => (
    <tr className="animate-pulse">
        <td className="px-5 py-4 border-b border-slate-200 bg-white text-sm"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
        <td className="px-5 py-4 border-b border-slate-200 bg-white text-sm"><div className="h-4 bg-slate-200 rounded w-32"></div></td>
        <td className="px-5 py-4 border-b border-slate-200 bg-white text-sm"><div className="h-4 bg-slate-200 rounded w-24"></div></td>
        <td className="px-5 py-4 border-b border-slate-200 bg-white text-sm text-right"><div className="h-4 bg-slate-200 rounded w-16 ml-auto"></div></td>
        <td className="px-5 py-4 border-b border-slate-200 bg-white text-sm"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
        <td className="px-5 py-4 border-b border-slate-200 bg-white text-sm"><div className="flex gap-2"><div className="h-6 w-6 bg-slate-200 rounded"></div><div className="h-6 w-6 bg-slate-200 rounded"></div></div></td>
    </tr>
);

// Function to fetch ALL transactions (client-side filtering/pagination for now)
const fetchAllTransactions = async (dateRange) => {
  const [incomesRes, expensesRes, recurringIncomeDefsRes] = await Promise.all([
    apiClient.get('/incomes'),
    apiClient.get('/expenses'),
    apiClient.get('/recurring-income-definitions')
  ]);

  const incomes = incomesRes.data.map(inc => ({ ...inc, type: 'income', transactionDate: inc.date, isExpense: false }));
  const expenses = expensesRes.data.map(exp => ({ ...exp, type: 'expense', transactionDate: exp.date, isExpense: true }));

  // Build a lookup: { [parentId]: Set of YYYY-MM-DD strings }
  const realRecurringIncomeMap = {};
  incomes.forEach(inc => {
    if (inc.parentId && inc.date) {
      const key = `${Number(inc.parentId)}-${format(parseISO(inc.date), 'yyyy-MM-dd')}`;
      realRecurringIncomeMap[key] = true;
    }
  });

  const recurringIncomeDefs = (recurringIncomeDefsRes.data || []);
  let plannedRecurringInstances = [];
  const from = dateRange?.from ? startOfMonth(dateRange.from) : null;
  const to = dateRange?.to ? endOfMonth(dateRange.to) : null;

  recurringIncomeDefs.forEach(def => {
    if (!def.isActive) return;
    let current = parseISO(def.startDate);
    const freq = def.frequency || 'monthly';
    const interval = def.interval || 1;
    let count = 0;
    let maxOccurrences = def.occurrences || 120;
    let endDate = def.endDate ? parseISO(def.endDate) : null;
    // advance to first relevant date
    while (from && current < from) {
      if (freq === 'monthly') {
        current = addMonths(current, interval);
      } else if (freq === 'yearly') {
        current = addMonths(current, 12 * interval);
      } else {
        break;
      }
      count++;
      if (def.occurrences && count >= def.occurrences) break;
      if (endDate && current > endDate) break;
    }
    // generate for each period in range
    while (
      (!to || current <= to) &&
      (!endDate || current <= endDate) &&
      (!def.occurrences || count < def.occurrences)
    ) {
      // Use parentId+date as the key for duplicate prevention
      const plannedKey = `${Number(def.id)}-${format(current, 'yyyy-MM-dd')}`;
      // Check for real income with parentId for this date
      const hasRealInstance = realRecurringIncomeMap[plannedKey];
      if (!hasRealInstance) {
        plannedRecurringInstances.push({
          ...def,
          id: `${def.id}-planned-${format(current, 'yyyy-MM-dd')}`,
          type: 'income',
          isRecurringInstance: true,
          isProcessed: false,
          transactionDate: format(current, 'yyyy-MM-dd'),
          date: format(current, 'yyyy-MM-dd'),
          description: (def.description || '') + ' (מתוכנן)',
          categoryId: def.categoryId,
          category: def.category,
          recurringDefinitionId: def.id,
          parentId: Number(def.id), // always number for robust comparison
          plannedInstanceDate: format(current, 'yyyy-MM-dd'),
        });
      }
      // advance
      if (freq === 'monthly') {
        current = addMonths(current, interval);
      } else if (freq === 'yearly') {
        current = addMonths(current, 12 * interval);
      } else {
        break;
      }
      count++;
    }
  });

  let allTransactions = [...incomes, ...expenses, ...plannedRecurringInstances];
  // מיון ברירת מחדל (יישאר גם אם המיון הדינמי יחליף אותו מאוחר יותר)
  allTransactions.sort((a, b) => parseISO(b.transactionDate).getTime() - parseISO(a.transactionDate).getTime() || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return allTransactions;
};

const restoreMutationFn = async ({ type, id }) => {
    const endpoint = type === 'income' ? `/incomes/${id}/restore` : `/expenses/${id}/restore`;
    return apiClient.patch(endpoint);
};

// --- End Helper Functions ---

const markAsProcessedMutationFn = async (transaction) => {
    // If this is a planned recurring income instance, create a real income
    if (transaction.isRecurringInstance && transaction.type === 'income') {
        // Build the payload for the new income
        const payload = {
            amount: transaction.amount,
            description: transaction.description?.replace(' (מתוכנן)', '') || '',
            date: transaction.plannedInstanceDate || transaction.date,
            categoryId: transaction.categoryId,
            // אפשר להוסיף שדות נוספים במידת הצורך
            recurringDefinitionId: transaction.recurringDefinitionId || transaction.id
        };
        return apiClient.post('/incomes', payload);
    }
    if (transaction.type === 'income') {
        return apiClient.patch(`/incomes/${transaction.id}/mark-processed`);
    } else {
        return apiClient.patch(`/expenses/${transaction.id}/process`);
    }
};

function TransactionsListPage() {
  const { user } = useAuth(); 
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [initialModalType, setInitialModalType] = useState('expense');
  const [showRecurringActionModal, setShowRecurringActionModal] = useState(false);
  const [recurringActionType, setRecurringActionType] = useState(null); // 'delete' | 'edit'
  const [recurringActionTarget, setRecurringActionTarget] = useState(null); // transaction object
  
  // Filter states
  const [filterType, setFilterType] = useState('all'); // 'all', 'income', 'expense'
  const [showPlanned, setShowPlanned] = useState(true); 
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMainCategory, setFilterMainCategory] = useState('all');
  const [dateRange, setDateRange] = useState({
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date())
  });

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Sort state
  const [sortConfig, setSortConfig] = useState({ key: 'transactionDate', direction: 'descending' });

  // Query for ALL transactions (will be filtered/paginated client-side)
  const { data: rawTransactions, isLoading, error, refetch } = useQuery({
    queryKey: ['allTransactions', dateRange.from?.toISOString(), dateRange.to?.toISOString()],
    queryFn: () => fetchAllTransactions(dateRange),
  });

  // Query for categories (for filter dropdown)
  const { data: categoriesForFilter } = useQuery({
    queryKey: ['categoriesForFilter'],
    queryFn: async () => {
        // במצב אמיתי, ה-API יחזיר רק קטגוריות ראשיות או שיש דרך לסנן
        const [incomeCats, expenseCats] = await Promise.all([
            apiClient.get('/categories?type=income'),
            apiClient.get('/categories?type=expense')
        ]);
        // הנחה שקטגוריות ראשיות להוצאה הן אלו שאין להן parentId או שהן פשוטות
        const mainExpenseCategories = expenseCats.data.filter(cat => !cat.parentId || cat.subcategories?.length > 0); 
        return [...incomeCats.data, ...mainExpenseCategories];
    },
    staleTime: Infinity, // קטגוריות לא משתנות בתדירות גבוהה
  });


  // useQuery for monthly summary (and error)
const selectedPeriodForSummary = useMemo(() => {
    if (dateRange.from) {
        return format(dateRange.from, 'yyyy-MM');
    }
    return format(new Date(), 'yyyy-MM');
}, [dateRange.from]);


const { data: periodSummary, isLoading: isLoadingSummary, error: periodSummaryError } = useQuery({
    queryKey: ['dashboardSummary', selectedPeriodForSummary],
    queryFn: async () => {
        const { data } = await apiClient.get(`/dashboard/summary?period=${selectedPeriodForSummary}`);
        return data;
    },
    enabled: !!selectedPeriodForSummary,
    staleTime: 1000 * 60 * 5,
});


  // Client-side filtering, sorting, and pagination
  const processedData = useMemo(() => {
    if (!rawTransactions) return { items: [], totalCount: 0 };
    
    let filtered = rawTransactions;

    // 1. Filter by date range
    if (dateRange.from) {
        filtered = filtered.filter(tx => parseISO(tx.transactionDate) >= dateRange.from);
    }
    if (dateRange.to) {
        const endOfDayTo = new Date(dateRange.to);
        endOfDayTo.setHours(23, 59, 59, 999);
        filtered = filtered.filter(tx => parseISO(tx.transactionDate) <= endOfDayTo);
    }

    // 2. Filter by type
    if (filterType !== 'all') {
        filtered = filtered.filter(tx => tx.type === filterType);
    }

    // 3. Filter by planned status
    if (!showPlanned) {
        filtered = filtered.filter(tx => tx.type === 'income' || tx.isProcessed);
    }

    // 4. Filter by main category
    if (filterMainCategory !== 'all') {
        const catId = parseInt(filterMainCategory);
        filtered = filtered.filter(tx => {
            if (tx.type === 'income') return tx.categoryId === catId;
            return tx.subcategory?.categoryId === catId;
        });
    }

    // 5. Filter by search term
    if (searchTerm) {
        const lowerSearchTerm = searchTerm.toLowerCase();
        filtered = filtered.filter(tx => 
            (tx.description && tx.description.toLowerCase().includes(lowerSearchTerm)) ||
            (tx.subcategory?.name && tx.subcategory.name.toLowerCase().includes(lowerSearchTerm)) ||
            (tx.subcategory?.category?.name && tx.subcategory.category.name.toLowerCase().includes(lowerSearchTerm)) ||
            (tx.category?.name && tx.category.name.toLowerCase().includes(lowerSearchTerm))
        );
    }

    // 6. Sort
    if (sortConfig.key) {
        filtered.sort((a, b) => {
            let valA = a[sortConfig.key];
            let valB = b[sortConfig.key];

            if (sortConfig.key === 'transactionDate' || sortConfig.key === 'date') {
                valA = valA ? parseISO(valA).getTime() : 0;
                valB = valB ? parseISO(valB).getTime() : 0;
            } else if (sortConfig.key === 'amount') {
                valA = parseFloat(valA) || 0;
                valB = parseFloat(valB) || 0;
            } else if (sortConfig.key === 'description') { // מיון לפי התיאור המוצג
                valA = getTransactionDisplayDetails(a).displayDescription.toLowerCase();
                valB = getTransactionDisplayDetails(b).displayDescription.toLowerCase();
            } else if (typeof valA === 'string' && typeof valB === 'string') {
                valA = valA.toLowerCase();
                valB = valB.toLowerCase();
            } else if (valA === null || valA === undefined || valB === null || valB === undefined || typeof valA !== typeof valB) {
                return 0;
            }

            if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
            return 0;
        });
    }
    
    const totalCount = filtered.length;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    
    return { items: filtered.slice(startIndex, endIndex), totalCount };
  }, [rawTransactions, filterType, showPlanned, searchTerm, filterMainCategory, dateRange, currentPage, itemsPerPage, sortConfig]);

  const transactions = processedData.items;
  const totalTransactionsCount = processedData.totalCount;
  const totalPages = Math.ceil(totalTransactionsCount / itemsPerPage);

  useEffect(() => { // אם המסננים משתנים והמשתמש לא בעמוד הראשון, החזר לעמוד 1
    setCurrentPage(1);
  }, [filterType, showPlanned, searchTerm, filterMainCategory, dateRange, itemsPerPage]);


  const deleteMutation = useMutation({
    mutationFn: ({ type, id, isRecurringInstance, recurringDefinitionId }) => {
      // אם זו recurring income definition, שלח ל-endpoint המתאים עם מזהה מספרי בלבד
      if (type === 'income' && isRecurringInstance) {
        const defId = recurringDefinitionId || (typeof id === 'string' && id.split('-')[0]) || id;
        return apiClient.delete(`/recurring-income-definitions/${defId}`);
      }
      const endpoint = type === 'income' ? `/incomes/${id}` : `/expenses/${id}`;
      return apiClient.delete(endpoint);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allTransactions'] });
      ['dashboardSummary', 'recentTransactions', 'expenseDistribution'].forEach(key => 
        queryClient.invalidateQueries({ queryKey: [key], exact: false })
      );
    },
    onError: (err, variables) => {
        const actionType = variables.type === 'income' ? 'הכנסה' : 'הוצאה';
        alert(`שגיאה במחיקת ${actionType}: ${err.response?.data?.message || err.message}`);
    }
  });
  
  const restoreMutation = useMutation({
      mutationFn: restoreMutationFn,
      onSuccess: () => {
          queryClient.invalidateQueries({queryKey: ['allTransactions']});
          ['dashboardSummary', 'recentTransactions', 'expenseDistribution'].forEach(key => 
            queryClient.invalidateQueries({ queryKey: [key], exact: false })
          );
      },
      onError: (err, variables) => {
          const actionType = variables.type === 'income' ? 'הכנסה' : 'הוצאה';
          alert(`שגיאה בשחזור ${actionType}: ${err.response?.data?.message || err.message}`);
      }
  });

  // סימון כבוצע: מניעת כפילות הכנסה מתוכננת
  // כאשר מסמנים מופע הכנסה חוזרת כבוצע, יש לרענן את כל הרשימה (invalidateQueries) כדי שההכנסה המתוכננת תיעלם
  // וגם לא להציג פעמיים הכנסה לאותו תאריך/parentId
  // (ה-backend כבר מונע כפילות, אך נוודא שה-front לא יוצר פעמיים)
  // ב-fetchAllTransactions כבר יש מנגנון realRecurringIncomeMap שמונע כפילות, לכן אין צורך לשנות שם
  // נוודא invalidateQueries מלא אחרי סימון כבוצע
  const markAsProcessedMutation = useMutation({
    mutationFn: markAsProcessedMutationFn,
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['allTransactions'] });
        queryClient.invalidateQueries({ queryKey: ['incomes'] });
        queryClient.invalidateQueries({ queryKey: ['expenses'] });
        ['dashboardSummary', 'recentTransactions', 'expenseDistribution'].forEach(key => 
          queryClient.invalidateQueries({ queryKey: [key], exact: false })
        );
    },
    onError: (err) => {
        alert(`שגיאה בסימון כבוצע: ${err.response?.data?.message || err.message}`);
    }
  });

  const handleDelete = (type, id, isRecurringInstance, recurringDefinitionId, txObj) => {
    if (isRecurringInstance && type === 'income') {
      setRecurringActionType('delete');
      setRecurringActionTarget({ type, id, recurringDefinitionId, txObj });
      setShowRecurringActionModal(true);
    } else {
      if (window.confirm(`האם אתה בטוח שברצונך למחוק (לארכב) ${type === 'income' ? 'הכנסה' : 'הוצאה'} זו?`)) {
        deleteMutation.mutate({ type, id, isRecurringInstance, recurringDefinitionId });
      }
    }
  };

  // --- עריכה חכמה ---
  const openEditModal = (transaction) => {
    if (transaction.isRecurringInstance && transaction.type === 'income') {
      setRecurringActionType('edit');
      setRecurringActionTarget(transaction);
      setShowRecurringActionModal(true);
    } else {
      setInitialModalType(transaction.type || (transaction.isExpense ? 'expense' : 'income'));
      setEditingTransaction(transaction);
      setIsModalOpen(true);
    }
  };

  // --- ביצוע פעולה חכמה (מחיקה/עריכה) ---
  const handleRecurringAction = async (action) => {
    setShowRecurringActionModal(false);
    if (!recurringActionTarget) return;
    const { type, id, recurringDefinitionId, txObj } = recurringActionTarget;
    if (recurringActionType === 'delete') {
      if (action === 'all') {
        await deleteMutation.mutateAsync({ type, id: recurringDefinitionId, isRecurringInstance: true, recurringDefinitionId });
      } else if (action === 'single') {
        await deleteMutation.mutateAsync({ type, id, isRecurringInstance: false });
        // כאן אפשר להוסיף קריאה ל-backend לעדכן occurrences/תאריכים של ההגדרה
      }
    } else if (recurringActionType === 'edit') {
      setInitialModalType('income');
      setEditingTransaction({ ...recurringActionTarget, editAllRecurring: action === 'all' });
      setIsModalOpen(true);
    }
    setRecurringActionTarget(null);
    setRecurringActionType(null);
  };

  const openAddModal = (type = 'expense') => {
    setEditingTransaction(null);
    setInitialModalType(type);
    setIsModalOpen(true);
  };

// הוצאנו את ה-hook החוצה, getTransactionDisplayDetails היא פונקציה רגילה
const getTransactionDisplayDetails = (transaction) => {
  let categoryDisplay = 'ללא קטגוריה';
  let mainCategoryForTooltip = '';

  if (transaction.type === 'income' && transaction.category) {
      categoryDisplay = transaction.category.name_he || transaction.category.name;
      mainCategoryForTooltip = categoryDisplay;
  } else if (transaction.type === 'expense' && transaction.subcategory) {
      const subcatName = transaction.subcategory.name_he || transaction.subcategory.name;
      if (transaction.subcategory.category) {
          mainCategoryForTooltip = transaction.subcategory.category.name_he || transaction.subcategory.category.name;
          categoryDisplay = `${mainCategoryForTooltip} - ${subcatName}`;
      } else {
          categoryDisplay = subcatName;
          mainCategoryForTooltip = subcatName;
      }
  }

  let finalDescription = transaction.description || categoryDisplay;
  if (transaction.expenseType === 'recurring_instance') finalDescription = `(ח) ${finalDescription}`;
  if (transaction.expenseType === 'installment_instance') finalDescription = `(ת) ${finalDescription}`;

  return {
    displayDescription: finalDescription,
    tooltipText: transaction.description && transaction.description !== categoryDisplay ? `${transaction.description} [${categoryDisplay}]` : finalDescription,
    icon: transaction.type === 'income' ? <FiDollarSign className="text-green-500" /> : <FiCreditCard className="text-red-500" />
  };
};

  const handleSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    } else if (sortConfig.key === key && sortConfig.direction === 'descending') {
      // חזרה לברירת מחדל (תאריך יורד) אם לוחצים שוב
      key = 'transactionDate'; 
      direction = 'descending';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1); // חזור לעמוד הראשון לאחר מיון
  };

  const SortableHeader = ({ columnKey, title }) => {
    const isSorted = sortConfig.key === columnKey;
    const Icon = sortConfig.direction === 'ascending' ? FiArrowUp : FiArrowDown;
    return (
        <th 
            className="px-5 py-3 cursor-pointer hover:bg-slate-100 select-none"
            onClick={() => handleSort(columnKey)}
        >
            <div className="flex items-center justify-end"> {/* justify-end לטקסט מימין */}
                {title}
                {isSorted && <Icon className="ml-1 w-4 h-4" />} {/* ml-1 במקום mr-1 עבור RTL */}
            </div>
        </th>
    );
  };


  // --- סימון פעולה כבוצע (כולל מופע הכנסה חוזרת מתוכננת) ---
  const handleMarkAsProcessed = (transaction) => {
    markAsProcessedMutation.mutate(transaction);
  };

  if (error) return ( <div className="flex flex-col items-center justify-center h-64 text-red-600 bg-red-50 p-4 rounded-md"><FiAlertTriangle className="h-12 w-12 mb-4"/><p className="text-xl font-semibold">שגיאה בטעינת הפעולות</p><p>{error.message || "לא ניתן היה לטעון את הנתונים."}</p><button onClick={() => refetch()} className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">נסה שוב</button></div>);
  if (isLoading && !rawTransactions) return ( // הצג טעינה ראשונית אם אין נתונים בכלל
    <div className="p-4 md:p-6">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">כל הפעולות</h1>
        </div>
        <div className="mb-6 p-4 bg-slate-50 rounded-lg shadow animate-pulse">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-end">
                {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-slate-200 rounded-md"></div>)}
            </div>
        </div>
        <div className="bg-white shadow-xl rounded-xl overflow-x-auto">
            <table className="min-w-full leading-normal">
            <thead><tr className="border-b-2 border-slate-200 bg-slate-100 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider"><th className="px-5 py-3">תאריך</th><th className="px-5 py-3">תיאור / קטגוריה</th><th className="px-5 py-3">סוג</th><th className="px-5 py-3">סכום</th><th className="px-5 py-3">סטטוס</th><th className="px-5 py-3">פעולות</th></tr></thead>
            <tbody>
                {[...Array(itemsPerPage > 7 ? 7 : itemsPerPage)].map((_, i) => <SkeletonRow key={`skel-load-${i}`} />)}
            </tbody>
            </table>
        </div>
    </div>
  );

  if (error && !rawTransactions) return ( // הצג שגיאה ראשונית אם אין נתונים
    <div className="p-4 md:p-6">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
             <h1 className="text-2xl md:text-3xl font-bold text-slate-800">כל הפעולות</h1>
        </div>
        <div className="flex flex-col items-center justify-center h-64 text-red-600 bg-red-50 p-4 rounded-md">
            <FiAlertTriangle className="h-12 w-12 mb-4"/>
            <p className="text-xl font-semibold">שגיאה בטעינת הפעולות</p>
            <p>{error.message || "לא ניתן היה לטעון את הנתונים."}</p>
            <button 
                onClick={() => refetch()} 
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
                נסה שוב
            </button>
        </div>
    </div>
  );


  return (
    <div className="p-4 md:p-6" dir="rtl"> {/* ודא שה-direction מוגדר נכון אם צריך */}
      {/* Section for Page Title and Monthly Summary */}
      <div className="flex flex-col md:flex-row justify-between items-start mb-4 gap-y-3">
        <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">כל הפעולות</h1>
            {/* Display Monthly Summary */}
{isLoadingSummary && <p className="text-xs text-slate-500 mt-1 animate-pulse">טוען סיכום חודשי...</p>}
            {periodSummary && (
                <div className="text-xs mt-1 text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                    <span>
                        חודש: <span className="font-semibold">{format(parseISO(periodSummary.period.startDate), 'MMMM yyyy', { locale: he })}</span>
                    </span>
                    <span>
                        הכנסות: <span className="font-semibold text-green-600">{formatCurrency(periodSummary.totalIncome)}</span>
                    </span>
                    <span>
                        הוצאות (שבוצעו): <span className="font-semibold text-red-600">{formatCurrency(periodSummary.totalExpenses)}</span>
                    </span>
                    <span>
                        מאזן: <span className={`font-semibold ${periodSummary.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(periodSummary.balance)}</span>
                    </span>
                    {periodSummary.budget && periodSummary.budget.goal !== null && (
                        <span>
                            תקציב: <span className="font-semibold text-slate-700">{formatCurrency(periodSummary.budget.goal)}</span> | 
                            ניצול: <span className="font-semibold">{periodSummary.budget.percentage?.toFixed(0) || 0}%</span>
                        </span>
                    )}
                </div>
            )}
             {/* Error message for summary if needed */}
            {periodSummaryError && !isLoadingSummary && ( 
             <p className="text-xs text-red-500 mt-1">שגיאה בטעינת סיכום חודשי: {periodSummaryError.message}</p>
            )}

        </div>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto self-start md:self-center mt-2 md:mt-0">
            <button 
                onClick={() => openAddModal('expense')} 
                className="flex items-center px-4 py-2.5 bg-sky-600 text-white rounded-lg shadow hover:bg-sky-700 transition text-sm font-medium order-last md:order-first" 
                title="הוסף פעולה חדשה"
            >
                <FiPlusCircle className="ml-2 h-5 w-5" /> הוסף {/* החלפתי mr-2 ל-ml-2 עבור RTL */}
            </button>
            <button 
                onClick={() => refetch()} 
                disabled={isLoading || deleteMutation.isLoading || restoreMutation.isLoading || markAsProcessedMutation.isLoading} 
                className="p-2.5 rounded-md text-slate-600 hover:text-sky-700 hover:bg-sky-100 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-60 transition" 
                title="רענן רשימה"
            >
                <FiRefreshCw className={`h-5 w-5 ${isLoading || deleteMutation.isLoading || restoreMutation.isLoading || markAsProcessedMutation.isLoading ? 'animate-spin' : ''}`} />
            </button>
        </div>
      </div>
      
      {/* Filter Controls Section */}
      <div className="mb-6 p-4 bg-slate-50 rounded-lg shadow">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-end">
            {/* Date Range From */}
            <div>
                <label htmlFor="dateFrom" className="block text-xs font-medium text-slate-600 mb-1">מתאריך</label>
                <input 
                    type="date"
                    id="dateFrom"
                    value={dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : ''}
                    onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value ? parseISO(e.target.value) : null }))}
                    className="w-full p-2 border border-slate-300 rounded-md bg-white text-sm shadow-sm focus:ring-sky-500 focus:border-sky-500"
                />
            </div>
             {/* Date Range To */}
            <div>
                <label htmlFor="dateTo" className="block text-xs font-medium text-slate-600 mb-1">עד תאריך</label>
                <input 
                    type="date" 
                    id="dateTo"
                    value={dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : ''}
                    onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value ? parseISO(e.target.value) : null }))}
                    className="w-full p-2 border border-slate-300 rounded-md bg-white text-sm shadow-sm focus:ring-sky-500 focus:border-sky-500"
                />
            </div>
            {/* Quick Month Navigation */}
            <div className="flex gap-2 items-center col-span-1 sm:col-span-2 lg:col-span-1 xl:col-span-2 justify-start sm:justify-end">
                <button onClick={() => setDateRange(prev => ({ from: startOfMonth(subMonths(prev.from || new Date(), 1)), to: endOfMonth(subMonths(prev.from || new Date(), 1))}))} className="p-2 border border-slate-300 rounded-md bg-white hover:bg-slate-100 text-sm text-slate-700 shadow-sm whitespace-nowrap">
                    {'< חודש קודם'}
                </button>
                <button onClick={() => setDateRange({ from: startOfMonth(new Date()), to: endOfMonth(new Date())})}  className="p-2 border border-slate-300 rounded-md bg-white hover:bg-slate-100 text-sm text-slate-700 shadow-sm whitespace-nowrap">
                    חודש נוכחי
                </button>
                <button onClick={() => setDateRange(prev => ({ from: startOfMonth(addMonths(prev.from || new Date(), 1)), to: endOfMonth(addMonths(prev.from || new Date(), 1))}))} className="p-2 border border-slate-300 rounded-md bg-white hover:bg-slate-100 text-sm text-slate-700 shadow-sm whitespace-nowrap">
                    {'חודש הבא >'}
                </button>
            </div>

            {/* Type Filter */}
            <div className="relative">
                 <label htmlFor="filterType" className="block text-xs font-medium text-slate-600 mb-1">סוג פעולה</label>
                <select id="filterType" value={filterType} onChange={(e) => setFilterType(e.target.value)} className="appearance-none w-full p-2.5 pl-8 border border-slate-300 rounded-md bg-white text-sm shadow-sm focus:ring-sky-500 focus:border-sky-500"> {/* החלפתי pr-8 ל-pl-8 עבור RTL */}
                    <option value="all">כל הסוגים</option>
                    <option value="income">הכנסות</option>
                    <option value="expense">הוצאות</option>
                </select>
                <FiChevronDown className="absolute right-3 top-1/2 mt-1.5 h-4 w-4 text-slate-400 pointer-events-none"/> {/* שונה ל-right-3 */}
            </div>
            {/* Category Filter */}
            <div className="relative">
                <label htmlFor="filterMainCategory" className="block text-xs font-medium text-slate-600 mb-1">קטגוריה ראשית</label>
                <select 
                    id="filterMainCategory"
                    value={filterMainCategory} 
                    onChange={(e) => setFilterMainCategory(e.target.value)}
                    className="appearance-none w-full p-2.5 pl-8 border border-slate-300 rounded-md bg-white text-sm shadow-sm focus:ring-sky-500 focus:border-sky-500"
                >
                    <option value="all">כל הקטגוריות</option>
                    {categoriesForFilter?.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name_he || cat.name}</option>
                    ))}
                </select>
                <FiChevronDown className="absolute right-3 top-1/2 mt-1.5 h-4 w-4 text-slate-400 pointer-events-none"/>
            </div>
            {/* Search Term */}
            <div className="relative">
                <label htmlFor="searchTerm" className="block text-xs font-medium text-slate-600 mb-1">חיפוש חופשי</label>
                <input 
                    type="text" 
                    id="searchTerm"
                    placeholder="תיאור, קטגוריה..." 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="p-2.5 pr-8 pl-3 w-full border border-slate-300 rounded-md bg-white text-sm shadow-sm focus:ring-sky-500 focus:border-sky-500" // pr-8 לריווח מהאייקון מימין
                />
                <FiSearch className="absolute right-3 top-1/2 mt-1.5 h-4 w-4 text-slate-400 pointer-events-none"/>
            </div>
            {/* Show Planned Checkbox */}
            <div className="flex items-end pb-1">
                <label className="flex items-center text-sm text-slate-700 cursor-pointer p-2.5 border border-slate-300 rounded-md bg-white shadow-sm hover:bg-slate-50 h-[42px] whitespace-nowrap">
                    <input type="checkbox" checked={showPlanned} onChange={(e) => setShowPlanned(e.target.checked)} className="form-checkbox h-4 w-4 text-sky-600 border-slate-400 rounded ml-2 focus:ring-sky-500" /> {/* החלפתי mr-2 ל-ml-2 */}
                    הצג מתוכננות
                </label>
            </div>
        </div>
      </div>
      
      {/* Modal למחיקה/עריכה של הכנסה חוזרת */}
      <Modal
        isOpen={showRecurringActionModal}
        onRequestClose={() => setShowRecurringActionModal(false)}
        contentLabel="פעולה על הכנסה חוזרת"
        ariaHideApp={false}
        style={{ content: { maxWidth: 400, margin: 'auto', textAlign: 'center' } }}
      >
        <h2 className="text-lg font-bold mb-4">{recurringActionType === 'delete' ? 'מחיקת הכנסה חוזרת' : 'עריכת הכנסה חוזרת'}</h2>
        <p className="mb-4">האם ברצונך {recurringActionType === 'delete' ? 'למחוק' : 'לערוך'} את כל המופעים של ההכנסה החוזרת, או רק את המופע הנוכחי?</p>
        <div className="flex gap-2 justify-center">
          <button className="px-4 py-2 bg-sky-600 text-white rounded hover:bg-sky-700" onClick={() => handleRecurringAction('all')}>את כל המופעים</button>
          <button className="px-4 py-2 bg-slate-200 text-slate-800 rounded hover:bg-slate-300" onClick={() => handleRecurringAction('single')}>רק את הנוכחית</button>
          <button className="px-4 py-2 bg-gray-100 text-gray-600 rounded hover:bg-gray-200" onClick={() => setShowRecurringActionModal(false)}>ביטול</button>
        </div>
      </Modal>

      <div className="bg-white shadow-xl rounded-xl overflow-x-auto">
        <table className="min-w-full leading-normal">
          <thead>
            <tr className="border-b-2 border-slate-200 bg-slate-100 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
              <SortableHeader columnKey="date" title="תאריך" />
              <SortableHeader columnKey="description" title="תיאור / קטגוריה" />
              <th className="px-5 py-3">סוג</th>
              <SortableHeader columnKey="amount" title="סכום" />
              <th className="px-5 py-3">סטטוס</th>
              <th className="px-5 py-3 text-center">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && !rawTransactions && [...Array(itemsPerPage > 7 ? 7 : itemsPerPage)].map((_, i) => <SkeletonRow key={`skel-full-load-${i}`} />)}
            {isLoading && rawTransactions && transactions.length === 0 && [...Array(3)].map((_, i) => <SkeletonRow key={`skel-filter-load-${i}`} />)}
            
            {!isLoading && transactions && transactions.length > 0 ? (
              transactions.map((tx) => {
                const displayDetails = getTransactionDisplayDetails(tx);
                const isDeleted = !!tx.deletedAt;
                
                let rowClassName = 'hover:bg-slate-50 transition-colors text-sm';
                if (isDeleted) {
                    rowClassName += ' opacity-60 bg-slate-100 italic line-through';
                } else if (tx.type === 'income') {
                    rowClassName += ' bg-green-50 hover:bg-green-100';
                } else { // expense
                    if (!tx.isProcessed) {
                        rowClassName += ' bg-sky-50 hover:bg-sky-100 font-medium';
                    } else {
                        // רקע לבן רגיל להוצאות שבוצעו, או צבע עדין אחר אם רוצים
                    }
                }

                return (
                  <tr key={`${tx.type}-${tx.id}-${tx.createdAt}`} className={rowClassName}>
                    <td className="px-5 py-3 border-b border-slate-200"><p className="text-slate-700 whitespace-no-wrap">{tx.date ? format(parseISO(tx.date), 'dd/MM/yy', { locale: he }) : '-'}</p></td>
                    <td className="px-5 py-3 border-b border-slate-200">
                        <div className="flex items-center">
                            <div className="ml-3 p-1.5 bg-slate-100 rounded-full shrink-0">{displayDetails.icon}</div>
                            <p className="text-slate-800 whitespace-no-wrap truncate max-w-xs" title={displayDetails.tooltipText}>
                                {displayDetails.displayDescription}
                            </p>
                        </div>
                    </td>
                    <td className="px-5 py-3 border-b border-slate-200">
                        <span className={`px-2.5 py-1 text-xs font-semibold leading-tight rounded-full ${tx.type === 'income' ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                            {tx.type === 'income' ? 'הכנסה' : 'הוצאה'}
                        </span>
                    </td>
                    <td className={`px-5 py-3 border-b border-slate-200 font-semibold text-left ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(tx.amount)}
                    </td>
                    <td className="px-5 py-3 border-b border-slate-200">
                        <span className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap ${
                            isDeleted ? 'bg-gray-200 text-gray-600' : 
                            (tx.isRecurringInstance && tx.type === 'income') ? 'bg-sky-200 text-sky-800 font-medium' :
                            (tx.isExpense && !tx.isProcessed ? 'bg-sky-200 text-sky-800 font-medium' : 'bg-slate-200 text-slate-700')
                        }`}>
        {/* סטטוס */}
        {isDeleted ? 'מאורכב' :
            (tx.isRecurringInstance && tx.type === 'income') ? 'מתוכנן' :
            (tx.isExpense && !tx.isProcessed ? 'מתוכנן לביצוע' :
            (tx.type === 'income' && !tx.isProcessed ? 'בוצע/רלוונטי' : 'בוצע/רלוונטי'))
        }
    </span>
                    </td>
                    <td className="px-5 py-3 border-b border-slate-200">
                        <div className="flex items-center justify-center space-x-1 space-x-reverse">
                            {!isDeleted && ((tx.isExpense && tx.isProcessed === false) || (tx.type === 'income' && tx.isProcessed === false && (!tx.isRecurringInstance || tx.isRecurringInstance))) && (
                                <button onClick={() => handleMarkAsProcessed(tx)} title="סמן כבוצע" className="text-slate-500 hover:text-green-600 p-1.5 rounded-md hover:bg-green-100 disabled:opacity-50" disabled={markAsProcessedMutation.isLoading && markAsProcessedMutation.variables === tx}>
                                    <FiCheckSquare className="w-4 h-4"/>
                                </button>
                            )}
                            {!isDeleted && (
                                <button onClick={() => openEditModal(tx)} title="ערוך" className="text-slate-500 hover:text-sky-600 p-1.5 rounded-md hover:bg-sky-100">
                                    <FiEdit className="w-4 h-4"/>
                                </button>
                            )}
                            {!isDeleted && (
                                <button onClick={() => handleDelete(tx.type, tx.id, tx.isRecurringInstance, tx.recurringDefinitionId, tx)} title="מחק (ארכב)" className="text-slate-500 hover:text-red-600 p-1.5 rounded-md hover:bg-red-100 disabled:opacity-50" disabled={deleteMutation.isLoading && deleteMutation.variables?.id === tx.id}>
                                    <FiTrash2 className="w-4 h-4"/>
                                </button>
                            )}
                            {isDeleted && (
                                <button onClick={() => handleRestore(tx.type, tx.id)} title="שחזר" className="text-slate-500 hover:text-green-600 p-1.5 rounded-md hover:bg-green-100 disabled:opacity-50" disabled={restoreMutation.isLoading && restoreMutation.variables?.id === tx.id}>
                                    <FiRotateCcw className="w-4 h-4"/>
                                </button>
                            )}
                        </div>
                    </td>
                  </tr>
                );
            })) : (
              !isLoading && ( <tr> <td colSpan="6" className="text-center py-16 text-slate-500"> <FiRepeat className="mx-auto h-16 w-16 text-slate-400 mb-3"/> <p className="text-lg">אין פעולות להצגה עבור הסינון הנוכחי.</p> <p className="text-sm">נסה להוסיף פעולה חדשה או לשנות את המסננים.</p> </td> </tr> )
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {!isLoading && totalTransactionsCount > 0 && (
        <div className="px-1 sm:px-5 py-5 bg-white border-t flex flex-col sm:flex-row items-center sm:justify-between mt-4 rounded-b-xl shadow-xl">
            <div className="flex items-center gap-x-2 mb-4 sm:mb-0">
                <span className="text-xs sm:text-sm text-slate-600">
                    סה"כ: <span className="font-medium">{totalTransactionsCount}</span> | 
                    מציג <span className="font-medium">{transactions.length === 0 && totalTransactionsCount > 0 ? 0 : transactions.length}</span>
                </span>
                <select 
                    value={itemsPerPage} 
                    onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                    className="text-xs sm:text-sm p-2 border border-slate-300 rounded-md bg-white shadow-sm focus:ring-sky-500 focus:border-sky-500"
                >
                    {[25, 50, 75, 100, 200].map(size => ( // הוספתי 200
                        <option key={size} value={size}>{size} בעמוד</option>
                    ))}
                </select>
            </div>
            {totalPages > 1 && (
                <div className="inline-flex">
                    <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="text-sm bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold py-2 px-3 rounded-r-md disabled:opacity-50 transition-colors"
                    >
                        הקודם
                    </button>
                    <span className="text-sm text-slate-700 py-2 px-4 bg-slate-100 border-t border-b border-slate-200">
                        עמוד {currentPage} / {totalPages}
                    </span>
                    <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="text-sm bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold py-2 px-3 rounded-l-md disabled:opacity-50 transition-colors"
                    >
                        הבא
                    </button>
                </div>
            )}
        </div>
    )}

      {isModalOpen && (
        <AddTransactionModal
            isOpen={isModalOpen}
            onClose={() => { setIsModalOpen(false); setEditingTransaction(null); }}
            initialType={initialModalType}
            transactionToEdit={editingTransaction}
        />
      )}
    </div>
  );
}

export default TransactionsListPage;