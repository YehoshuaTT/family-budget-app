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
import { useAuth } from '../contexts/AuthContext'; 

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
        <td className="px-5 py-4 border-b border-slate-200 bg-white text-sm"><div className="h-4 bg-slate-200 rounded w-24"></div></td>
        <td className="px-5 py-4 border-b border-slate-200 bg-white text-sm text-right"><div className="h-4 bg-slate-200 rounded w-16 ml-auto"></div></td>
        <td className="px-5 py-4 border-b border-slate-200 bg-white text-sm"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
        <td className="px-5 py-4 border-b border-slate-200 bg-white text-sm"><div className="flex gap-2 justify-center"><div className="h-6 w-6 bg-slate-200 rounded"></div><div className="h-6 w-6 bg-slate-200 rounded"></div></div></td>
    </tr>
);

const fetchAllTransactions = async () => {
  const [incomesRes, expensesRes] = await Promise.all([
    apiClient.get('/incomes'),
    apiClient.get('/expenses') 
  ]);

  const incomes = incomesRes.data.map(inc => ({ ...inc, type: 'income', transactionDate: inc.date, isExpense: false }));
  const expenses = expensesRes.data.map(exp => ({ ...exp, type: 'expense', transactionDate: exp.date, isExpense: true }));
  
  let allTransactions = [...incomes, ...expenses];
  allTransactions.sort((a, b) => {
    const dateA = a.transactionDate ? parseISO(a.transactionDate).getTime() : 0;
    const dateB = b.transactionDate ? parseISO(b.transactionDate).getTime() : 0;
    const dateComparison = dateB - dateA;
    if (dateComparison !== 0) return dateComparison;
    const createdAtA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const createdAtB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return createdAtB - createdAtA;
  });
  return allTransactions;
};

const restoreMutationFn = async ({ type, id }) => {
    const endpoint = type === 'income' ? `/incomes/${id}/restore` : `/expenses/${id}/restore`;
    return apiClient.patch(endpoint);
};

const markAsProcessedMutationFn = async (expenseId) => {
    return apiClient.patch(`/expenses/${expenseId}/process`);
};

function TransactionsListPage() {
  const { user } = useAuth(); 
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [initialModalType, setInitialModalType] = useState('expense');
  
  const [filterType, setFilterType] = useState('all');
  const [showPlanned, setShowPlanned] = useState(true); 
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMainCategory, setFilterMainCategory] = useState('all');
  const [dateRange, setDateRange] = useState({
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date())
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [sortConfig, setSortConfig] = useState({ key: 'transactionDate', direction: 'descending' });

  const { data: rawTransactions, isLoading, error, refetch } = useQuery({
    queryKey: ['allTransactions'],
    queryFn: fetchAllTransactions,
  });

  const { data: categoriesForFilter } = useQuery({
    queryKey: ['categoriesForFilter'],
    queryFn: async () => {
        const [incomeCatsRes, expenseCatsRes] = await Promise.all([
            apiClient.get('/categories?type=income'),
            apiClient.get('/categories?type=expense')
        ]);
        const incomeCategories = incomeCatsRes.data || [];
        const expenseCategoriesData = expenseCatsRes.data || [];
        const mainExpenseCategories = expenseCategoriesData; 
        return [...incomeCategories, ...mainExpenseCategories];
    },
    staleTime: Infinity,
  });

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

  const getTransactionDisplayDetails = (transaction) => {
    let categoryName = ''; 
    let mainCategoryName = ''; 
    let displayIcon = transaction.type === 'income' ? <FiDollarSign className="text-green-500" /> : <FiCreditCard className="text-red-500" />;

    if (transaction.type === 'income' && transaction.category) {
        categoryName = transaction.category.name_he || transaction.category.name;
        mainCategoryName = categoryName;
    } else if (transaction.type === 'expense' && transaction.subcategory) {
        categoryName = transaction.subcategory.name_he || transaction.subcategory.name;
        if (transaction.subcategory.category) {
            mainCategoryName = transaction.subcategory.category.name_he || transaction.subcategory.category.name;
        }
    }

    let finalDescription = transaction.description || (transaction.type === 'income' ? categoryName : `ללא תיאור`);
    if (transaction.expenseType === 'recurring_instance') finalDescription = `(ח) ${finalDescription}`;
    if (transaction.expenseType === 'installment_instance') finalDescription = `(ת) ${finalDescription}`;
    
    return {
      itemDescription: transaction.description || "---",
      displayCategory: categoryName || "ללא",
      mainCategory: mainCategoryName,
      fullDisplayInfoForTitle: finalDescription + (categoryName && categoryName !== "ללא" && transaction.description ? ` [${categoryName}]` : ''),
      icon: displayIcon
    };
  };

  const processedData = useMemo(() => {
    if (!rawTransactions) return { items: [], totalCount: 0 };
    
    let filtered = [...rawTransactions];

    if (dateRange.from) {
        filtered = filtered.filter(tx => tx.transactionDate && parseISO(tx.transactionDate) >= dateRange.from);
    }
    if (dateRange.to) {
        const endOfDayTo = new Date(dateRange.to);
        endOfDayTo.setHours(23, 59, 59, 999);
        filtered = filtered.filter(tx => tx.transactionDate && parseISO(tx.transactionDate) <= endOfDayTo);
    }

    if (filterType !== 'all') {
        filtered = filtered.filter(tx => tx.type === filterType);
    }

    if (!showPlanned) {
        filtered = filtered.filter(tx => tx.type === 'income' || tx.isProcessed === true);
    }

    if (filterMainCategory !== 'all') {
        const selectedCatId = parseInt(filterMainCategory);
        filtered = filtered.filter(tx => {
            if (tx.type === 'income') return tx.categoryId === selectedCatId;
            return tx.subcategory?.categoryId === selectedCatId;
        });
    }

    if (searchTerm) {
        const lowerSearchTerm = searchTerm.toLowerCase();
        filtered = filtered.filter(tx => {
            const details = getTransactionDisplayDetails(tx);
            return details.itemDescription.toLowerCase().includes(lowerSearchTerm) || // חיפוש בתיאור הנקי
                   details.displayCategory.toLowerCase().includes(lowerSearchTerm) || // חיפוש בקטגוריה/תת-קטגוריה
                   details.mainCategory.toLowerCase().includes(lowerSearchTerm); // חיפוש בקטגוריה ראשית
        });
    }

    if (sortConfig.key) {
        filtered.sort((a, b) => {
            let valA = a[sortConfig.key];
            let valB = b[sortConfig.key];

            if (sortConfig.key === 'transactionDate' || sortConfig.key === 'date') {
                valA = valA ? parseISO(valA).getTime() : 0;
                valB = valB ? parseISO(valB).getTime() : 0;
            } else if (sortConfig.key === 'amount') {
                valA = parseFloat(a.amount) || 0;
                valB = parseFloat(b.amount) || 0;
            } else if (sortConfig.key === 'description') { // מיון לפי התיאור הנקי
                valA = getTransactionDisplayDetails(a).itemDescription.toLowerCase();
                valB = getTransactionDisplayDetails(b).itemDescription.toLowerCase();
            } else if (sortConfig.key === 'category') { // מיון לפי עמודת תת-הקטגוריה
                valA = getTransactionDisplayDetails(a).displayCategory.toLowerCase();
                valB = getTransactionDisplayDetails(b).displayCategory.toLowerCase();
            }
             else if (typeof valA === 'string' && typeof valB === 'string') { // Fallback for other string sorts
                valA = valA.toLowerCase();
                valB = valB.toLowerCase();
            } else if (valA === null || valA === undefined || valB === null || valB === undefined || typeof valA !== typeof valB) {
                return 0;
            }

            if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
            const createdAtA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const createdAtB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return createdAtB - createdAtA;
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

  useEffect(() => {
    setCurrentPage(1);
  }, [filterType, showPlanned, searchTerm, filterMainCategory, dateRange, itemsPerPage]);


  const deleteMutation = useMutation({
    mutationFn: ({ type, id }) => {
      const endpoint = type === 'income' ? `/incomes/${id}` : `/expenses/${id}`;
      return apiClient.delete(endpoint);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allTransactions'] });
      ['dashboardSummary', 'recentTransactions', 'expenseDistribution'].forEach(key => 
        queryClient.invalidateQueries({ queryKey: [key], exact: true })
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
            queryClient.invalidateQueries({ queryKey: [key], exact: true })
          );
      },
      onError: (err, variables) => {
          const actionType = variables.type === 'income' ? 'הכנסה' : 'הוצאה';
          alert(`שגיאה בשחזור ${actionType}: ${err.response?.data?.message || err.message}`);
      }
  });

  const markAsProcessedMutation = useMutation({
    mutationFn: markAsProcessedMutationFn,
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['allTransactions'] });
        ['dashboardSummary', 'recentTransactions', 'expenseDistribution'].forEach(key => 
          queryClient.invalidateQueries({ queryKey: [key], exact: true })
        );
    },
    onError: (err) => {
        alert(`שגיאה בסימון כבוצע: ${err.response?.data?.message || err.message}`);
    }
  });

  const handleDelete = (type, id) => {
    if (window.confirm(`האם אתה בטוח שברצונך למחוק (לארכב) ${type === 'income' ? 'הכנסה' : 'הוצאה'} זו?`)) {
      deleteMutation.mutate({ type, id });
    }
  };
  
  const handleRestore = (type, id) => {
    if (window.confirm(`האם אתה בטוח שברצונך לשחזר ${type === 'income' ? 'הכנסה' : 'הוצאה'} זו?`)) {
        restoreMutation.mutate({ type, id });
    }
  };
  
  const handleMarkAsProcessed = (expenseId) => {
    if (window.confirm('האם אתה בטוח שברצונך לסמן הוצאה זו כבוצעה?')) {
        markAsProcessedMutation.mutate(expenseId);
    }
  };

  const openEditModal = (transaction) => {
      setInitialModalType(transaction.type || (transaction.isExpense ? 'expense' : 'income'));
      setEditingTransaction(transaction);
      setIsModalOpen(true);
  };
  
  const openAddModal = (type = 'expense') => {
    setEditingTransaction(null);
    setInitialModalType(type);
    setIsModalOpen(true);
  };

  const handleSort = (key) => {
    let newDirection = 'ascending';
    if (sortConfig.key === key) {
        if (sortConfig.direction === 'ascending') {
            newDirection = 'descending';
        } else if (sortConfig.direction === 'descending') {
            setSortConfig({ key: 'transactionDate', direction: 'descending' });
            setCurrentPage(1);
            return;
        }
    }
    setSortConfig({ key, direction: newDirection });
    setCurrentPage(1);
  };

  const SortableHeader = ({ columnKey, title, align = 'right' }) => {
    const isSorted = sortConfig.key === columnKey;
    const Icon = sortConfig.direction === 'ascending' ? FiArrowUp : FiArrowDown;
    const textAlignClass = align === 'left' ? 'justify-start text-left' : 'justify-end text-right';
    return (
        <th 
            className={`px-5 py-3 cursor-pointer hover:bg-slate-200 select-none transition-colors`}
            onClick={() => handleSort(columnKey)}
        >
            <div className={`flex items-center ${textAlignClass}`}>
                {title}
                {isSorted && <Icon className="ml-1 w-4 h-4" />}
            </div>
        </th>
    );
  };

  if (error && !rawTransactions) {
    return (
      <div className="p-4 md:p-6" dir="rtl">
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
  }
  
  if (isLoading && !rawTransactions) {
    return (
      <div className="p-4 md:p-6" dir="rtl">
          <div className="flex flex-col md:flex-row justify-between items-start mb-4 gap-y-3">
              <div>
                  <div className="h-8 bg-slate-200 rounded w-48 mb-2 animate-pulse"></div>
                  <div className="h-4 bg-slate-200 rounded w-full max-w-md animate-pulse"></div>
              </div>
              <div className="flex gap-2 mt-2 md:mt-0">
                  <div className="h-10 w-24 bg-slate-200 rounded-md animate-pulse"></div>
                  <div className="h-10 w-10 bg-slate-200 rounded-md animate-pulse"></div>
              </div>
          </div>
          <div className="mb-6 p-4 bg-slate-50 rounded-lg shadow animate-pulse">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-end">
                  {[...Array(7)].map((_, i) => <div key={`filter-skel-${i}`} className="h-10 bg-slate-200 rounded-md"></div>)}
              </div>
          </div>
          <div className="bg-white shadow-xl rounded-xl overflow-x-auto">
              <table className="min-w-full leading-normal">
                <thead>
                    <tr className="border-b-2 border-slate-200 bg-slate-100 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        <th className="px-5 py-3">תאריך</th>
                        <th className="px-5 py-3">תיאור</th>
                        <th className="px-5 py-3">תת-קטגוריה</th>
                        <th className="px-5 py-3">סוג</th>
                        <th className="px-5 py-3">סכום</th>
                        <th className="px-5 py-3">סטטוס</th>
                        <th className="px-5 py-3 text-center">פעולות</th>
                    </tr>
                </thead>
                <tbody>
                    {[...Array(itemsPerPage > 7 ? 7 : itemsPerPage)].map((_, i) => <SkeletonRow key={`skel-load-${i}`} />)}
                </tbody>
              </table>
          </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start mb-4 gap-y-3">
        <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">כל הפעולות</h1>
            {isLoadingSummary && <p className="text-xs text-slate-500 mt-1 animate-pulse">טוען סיכום חודשי...</p>}
            {periodSummary && !isLoadingSummary && (
                <div className="text-xs mt-1 text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                    <span>חודש: <span className="font-semibold">{format(parseISO(periodSummary.period.startDate), 'MMMM yyyy', { locale: he })}</span></span>
                    <span>הכנסות: <span className="font-semibold text-green-600">{formatCurrency(periodSummary.totalIncome)}</span></span>
                    <span>הוצאות (שבוצעו): <span className="font-semibold text-red-600">{formatCurrency(periodSummary.totalExpenses)}</span></span>
                    <span>מאזן: <span className={`font-semibold ${periodSummary.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(periodSummary.balance)}</span></span>
                    {periodSummary.budget && periodSummary.budget.goal !== null && (
                        <span>
                            תקציב: <span className="font-semibold text-slate-700">{formatCurrency(periodSummary.budget.goal)}</span> | 
                            ניצול: <span className="font-semibold">{(periodSummary.budget.percentage !== undefined && periodSummary.budget.percentage !== null) ? periodSummary.budget.percentage.toFixed(0) : 0}%</span>
                        </span>
                    )}
                </div>
            )}
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
                <FiPlusCircle className="ml-2 h-5 w-5" /> הוסף
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
      
      <div className="mb-6 p-4 bg-slate-50 rounded-lg shadow">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-end">
            <div>
                <label htmlFor="dateFrom" className="block text-xs font-medium text-slate-600 mb-1">מתאריך</label>
                <input type="date" id="dateFrom" value={dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : ''} onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value ? parseISO(e.target.value) : null }))}
                    className="w-full p-2 border border-slate-300 rounded-md bg-white text-sm shadow-sm focus:ring-sky-500 focus:border-sky-500"/>
            </div>
            <div>
                <label htmlFor="dateTo" className="block text-xs font-medium text-slate-600 mb-1">עד תאריך</label>
                <input type="date" id="dateTo" value={dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : ''} onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value ? parseISO(e.target.value) : null }))}
                    className="w-full p-2 border border-slate-300 rounded-md bg-white text-sm shadow-sm focus:ring-sky-500 focus:border-sky-500"/>
            </div>
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
            <div className="relative">
                 <label htmlFor="filterType" className="block text-xs font-medium text-slate-600 mb-1">סוג פעולה</label>
                <select id="filterType" value={filterType} onChange={(e) => setFilterType(e.target.value)} className="appearance-none w-full p-2.5 pl-8 border border-slate-300 rounded-md bg-white text-sm shadow-sm focus:ring-sky-500 focus:border-sky-500">
                    <option value="all">כל הסוגים</option>
                    <option value="income">הכנסות</option>
                    <option value="expense">הוצאות</option>
                </select>
                <FiChevronDown className="absolute right-3 top-1/2 mt-1.5 h-4 w-4 text-slate-400 pointer-events-none"/>
            </div>
            <div className="relative">
                <label htmlFor="filterMainCategory" className="block text-xs font-medium text-slate-600 mb-1">קטגוריה ראשית</label>
                <select id="filterMainCategory" value={filterMainCategory} onChange={(e) => setFilterMainCategory(e.target.value)}
                    className="appearance-none w-full p-2.5 pl-8 border border-slate-300 rounded-md bg-white text-sm shadow-sm focus:ring-sky-500 focus:border-sky-500">
                    <option value="all">כל הקטגוריות</option>
                    {categoriesForFilter?.map((cat, idx) => (
                        <option key={`${cat.id}-${cat.type || 'cat'}-${idx}`} value={cat.id}> 
                            {cat.name_he || cat.name}
                        </option>
                    ))}
                </select>
                <FiChevronDown className="absolute right-3 top-1/2 mt-1.5 h-4 w-4 text-slate-400 pointer-events-none"/>
            </div>
            <div className="relative">
                <label htmlFor="searchTerm" className="block text-xs font-medium text-slate-600 mb-1">חיפוש חופשי</label>
                <input type="text" id="searchTerm" placeholder="תיאור, קטגוריה..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                    className="p-2.5 pr-8 pl-3 w-full border border-slate-300 rounded-md bg-white text-sm shadow-sm focus:ring-sky-500 focus:border-sky-500"/>
                <FiSearch className="absolute right-3 top-1/2 mt-1.5 h-4 w-4 text-slate-400 pointer-events-none"/>
            </div>
            <div className="flex items-end pb-1">
                <label className="flex items-center text-sm text-slate-700 cursor-pointer p-2.5 border border-slate-300 rounded-md bg-white shadow-sm hover:bg-slate-50 h-[42px] whitespace-nowrap">
                    <input type="checkbox" checked={showPlanned} onChange={(e) => setShowPlanned(e.target.checked)} className="form-checkbox h-4 w-4 text-sky-600 border-slate-400 rounded ml-2 focus:ring-sky-500" />
                    הצג מתוכננות
                </label>
            </div>
        </div>
      </div>
      
      <div className="bg-white shadow-xl rounded-xl overflow-x-auto">
        <table className="min-w-full leading-normal">
          <thead>
            <tr className="border-b-2 border-slate-200 bg-slate-100 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
              <SortableHeader columnKey="date" title="תאריך"/>
              <SortableHeader columnKey="description" title="תיאור"/>
              <SortableHeader columnKey="category" title="תת-קטגוריה"/>
              <th className="px-5 py-3">סוג</th>
              <SortableHeader columnKey="amount" title="סכום" align="left"/>
              <th className="px-5 py-3">סטטוס</th>
              <th className="px-5 py-3 text-center">פעולות</th>
            </tr>
          </thead>
          <tbody>{
            // לוגיקת רינדור השורות
            (isLoading && !rawTransactions) ? (
                [...Array(itemsPerPage > 7 ? 7 : itemsPerPage)].map((_, i) => <SkeletonRow key={`skel-full-load-${i}`}/>)
            ) : (isLoading && rawTransactions && transactions.length === 0 && totalTransactionsCount === 0) ? (
                [...Array(3)].map((_, i) => <SkeletonRow key={`skel-filter-load-${i}`} />)
            ) : (!isLoading && transactions.length > 0) ? (
                transactions.map((tx) => {
                    const displayDetails = getTransactionDisplayDetails(tx);
                    const isDeleted = !!tx.deletedAt;
                    let rowClassName = 'hover:bg-slate-50 transition-colors text-sm';
                    if (isDeleted) {
                        rowClassName += ' opacity-60 bg-slate-100 italic line-through';
                    } else if (tx.type === 'income') {
                        rowClassName += ' bg-green-50 hover:bg-green-100';
                    } else {
                        if (tx.isProcessed === false) {
                            rowClassName += ' bg-sky-50 hover:bg-sky-100 font-medium';
                        }
                    }
                    return (
                      <tr key={`${tx.type}-${tx.id}-${tx.createdAt || tx.id}`} className={rowClassName}>
                          <td className="px-5 py-3 border-b border-slate-200"><p className="text-slate-700 whitespace-no-wrap">{tx.date ? format(parseISO(tx.date), 'dd/MM/yy', { locale: he }) : '-'}</p></td>
                          <td className="px-5 py-3 border-b border-slate-200">
                              <div className="flex items-center">
                                  <div className="ml-3 p-1.5 bg-slate-100 rounded-full shrink-0">{displayDetails.icon}</div>
                                  <p className="text-slate-800 whitespace-no-wrap truncate max-w-xs" title={displayDetails.fullDisplayInfoForTitle}>
                                      {displayDetails.itemDescription}
                                  </p>
                              </div>
                          </td>
                          <td className="px-5 py-3 border-b border-slate-200 text-sm">
                              <p className="text-slate-700 whitespace-no-wrap" title={tx.type === 'expense' ? displayDetails.mainCategory : ''}>
                                  {displayDetails.displayCategory}
                              </p>
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
                                  (tx.isExpense && tx.isProcessed === false ? 'bg-sky-200 text-sky-800 font-medium' : 
                                  'bg-slate-200 text-slate-700')
                              }`}>
                                  {isDeleted ? 'מאורכב' : (tx.isExpense && tx.isProcessed === false ? 'מתוכנן לביצוע' : 'בוצע/רלוונטי')}
                              </span>
                          </td>
                          <td className="px-5 py-3 border-b border-slate-200">
                              <div className="flex items-center justify-center space-x-1 space-x-reverse">
                                {!isDeleted && tx.isExpense && tx.isProcessed === false && (
                                    <button onClick={() => handleMarkAsProcessed(tx.id)} title="סמן כבוצע" className="text-slate-500 hover:text-green-600 p-1.5 rounded-md hover:bg-green-100 disabled:opacity-50" disabled={markAsProcessedMutation.isLoading && markAsProcessedMutation.variables === tx.id}>
                                        <FiCheckSquare className="w-4 h-4"/>
                                    </button>
                                )}
                                {!isDeleted && (
                                    <button onClick={() => openEditModal(tx)} title="ערוך" className="text-slate-500 hover:text-sky-600 p-1.5 rounded-md hover:bg-sky-100">
                                        <FiEdit className="w-4 h-4"/>
                                    </button>
                                )}
                                {!isDeleted && (
                                    <button onClick={() => handleDelete(tx.type, tx.id)} title="מחק (ארכב)" className="text-slate-500 hover:text-red-600 p-1.5 rounded-md hover:bg-red-100 disabled:opacity-50" disabled={deleteMutation.isLoading && deleteMutation.variables?.id === tx.id}>
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
                })
            ) : (!isLoading ? (
                    <tr>
                      <td colSpan="7" className="text-center py-16 text-slate-500">
                        <FiRepeat className="mx-auto h-16 w-16 text-slate-400 mb-3"/>
                        <p className="text-lg">אין פעולות להצגה עבור הסינון הנוכחי.</p>
                        <p className="text-sm">נסה להוסיף פעולה חדשה או לשנות את המסננים.</p>
                      </td>
                    </tr>
                ) : null
            )
          }</tbody>
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
                    {[25, 50, 75, 100, 200].map(size => (
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