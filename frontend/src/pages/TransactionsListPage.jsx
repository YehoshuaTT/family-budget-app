// src/pages/TransactionsListPage.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import apiClient from '../api/apiClient';
import { format, parseISO, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { he } from 'date-fns/locale';
import { FiEdit, FiTrash2, FiRotateCcw, FiFilter, FiCalendar, FiDollarSign, FiCreditCard, FiAlertTriangle, FiPlusCircle, FiRepeat, FiCheckSquare, FiSquare, FiChevronDown, FiSearch, FiRefreshCw } from 'react-icons/fi';
import AddTransactionModal from '../components/transactions/AddTransactionModal';

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

// Function to fetch transactions with filters
const fetchTransactions = async ({ queryKey }) => {
  const [_key, filters] = queryKey; // Destructure filters from queryKey
  
  // Prepare query parameters for API based on filters
  // This is a placeholder. Your API needs to support these filters.
  const params = {
    // dateFrom: filters.dateFrom ? format(filters.dateFrom, 'yyyy-MM-dd') : undefined,
    // dateTo: filters.dateTo ? format(filters.dateTo, 'yyyy-MM-dd') : undefined,
    // type: filters.type !== 'all' ? filters.type : undefined,
    // includePlanned: filters.showPlanned, // Example
  };

  // For POC, we fetch all and filter client-side if API doesn't support all filters yet
  const [incomesRes, expensesRes] = await Promise.all([
    apiClient.get('/incomes', { params }), // Pass params to API
    apiClient.get('/expenses', { params })  // Pass params to API
  ]);

  const incomes = incomesRes.data.map(inc => ({ ...inc, type: 'income', transactionDate: inc.date, isExpense: false }));
  const expenses = expensesRes.data.map(exp => ({ ...exp, type: 'expense', transactionDate: exp.date, isExpense: true }));
  
  let allTransactions = [...incomes, ...expenses];
  allTransactions.sort((a, b) => parseISO(b.transactionDate).getTime() - parseISO(a.transactionDate).getTime() || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return allTransactions;
};

const restoreMutationFn = async ({ type, id }) => {
    const endpoint = type === 'income' ? `/incomes/${id}/restore` : `/expenses/${id}/restore`;
    return apiClient.patch(endpoint);
};


function TransactionsListPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [initialModalType, setInitialModalType] = useState('expense');
  
  // Filter states
  const [filterType, setFilterType] = useState('all'); // 'all', 'income', 'expense'
  const [showPlanned, setShowPlanned] = useState(true); // Show expenses with isProcessed=false
  const [searchTerm, setSearchTerm] = useState('');
  // TODO: Add date range filter state:
  // const [dateRange, setDateRange] = useState({ from: null, to: null });

  const queryKey = useMemo(() => ['transactions', { filterType, showPlanned, searchTerm /*, dateRange */ }], [filterType, showPlanned, searchTerm /*, dateRange */]);

  const { data: rawTransactions, isLoading, error, refetch } = useQuery({
    queryKey: queryKey,
    queryFn: fetchTransactions,
    // staleTime: 1000 * 60, // 1 minute
  });

  const transactions = useMemo(() => {
    if (!rawTransactions) return [];
    let filtered = rawTransactions;
    if (filterType !== 'all') {
        filtered = filtered.filter(tx => tx.type === filterType);
    }
    if (!showPlanned) {
        filtered = filtered.filter(tx => tx.type === 'income' || tx.isProcessed);
    }
    if (searchTerm) {
        const lowerSearchTerm = searchTerm.toLowerCase();
        filtered = filtered.filter(tx => 
            (tx.description && tx.description.toLowerCase().includes(lowerSearchTerm)) ||
            (tx.subcategory?.name && tx.subcategory.name.toLowerCase().includes(lowerSearchTerm)) ||
            (tx.category?.name && tx.category.name.toLowerCase().includes(lowerSearchTerm))
        );
    }
    return filtered;
  }, [rawTransactions, filterType, showPlanned, searchTerm]);


  const deleteMutation = useMutation({
    mutationFn: ({ type, id }) => {
      const endpoint = type === 'income' ? `/incomes/${id}` : `/expenses/${id}`;
      return apiClient.delete(endpoint);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKey });
      // Invalidate dashboard queries as well
      ['dashboardSummary', 'recentTransactions', 'expenseDistribution'].forEach(key => 
        queryClient.invalidateQueries({ queryKey: [key], exact: false }) // Invalidate all periods for summary/distribution
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
          queryClient.invalidateQueries({queryKey: queryKey});
          ['dashboardSummary', 'recentTransactions', 'expenseDistribution'].forEach(key => 
            queryClient.invalidateQueries({ queryKey: [key], exact: false })
          );
      },
      onError: (err, variables) => {
          const actionType = variables.type === 'income' ? 'הכנסה' : 'הוצאה';
          alert(`שגיאה בשחזור ${actionType}: ${err.response?.data?.message || err.message}`);
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

  const getTransactionDisplayDetails = (transaction) => {
    let categoryName = 'ללא קטגוריה';
    if (transaction.type === 'income' && transaction.category) {
        categoryName = transaction.category.name;
    } else if (transaction.type === 'expense' && transaction.subcategory) {
        categoryName = transaction.subcategory.name;
        if (transaction.subcategory.category) {
            categoryName = `${transaction.subcategory.category.name} - ${transaction.subcategory.name}`;
        }
    }

    let description = transaction.description || categoryName;
    if (transaction.expenseType === 'recurring_instance') description = `(ח) ${description}`;
    if (transaction.expenseType === 'installment_instance') description = `(ת) ${description}`;
    
    return {
      displayDescription: description, // This will be used for title and main display
      icon: transaction.type === 'income' ? <FiDollarSign className="text-green-500" /> : <FiCreditCard className="text-red-500" />
    };
  };


  if (error) return ( <div className="flex flex-col items-center justify-center h-64 text-red-600 bg-red-50 p-4 rounded-md"><FiAlertTriangle className="h-12 w-12 mb-4"/><p className="text-xl font-semibold">שגיאה בטעינת הפעולות</p><p>{error.message || "לא ניתן היה לטעון את הנתונים."}</p><button onClick={() => refetch()} className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">נסה שוב</button></div>);

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800">כל הפעולות</h1>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Filter Controls */}
            <div className="relative min-w-[150px]">
                <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="appearance-none w-full p-2.5 pr-8 border border-slate-300 rounded-md bg-white text-sm shadow-sm focus:ring-sky-500 focus:border-sky-500">
                    <option value="all">כל הסוגים</option>
                    <option value="income">הכנסות</option>
                    <option value="expense">הוצאות</option>
                </select>
                <FiChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none"/>
            </div>
             <div className="relative">
                <input 
                    type="text" 
                    placeholder="חפש תיאור/קטגוריה..." 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="p-2.5 pl-8 border border-slate-300 rounded-md bg-white text-sm shadow-sm focus:ring-sky-500 focus:border-sky-500 min-w-[200px]"
                />
                <FiSearch className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"/>
            </div>
            <label className="flex items-center text-sm text-slate-700 cursor-pointer p-2.5 border border-slate-300 rounded-md bg-white shadow-sm hover:bg-slate-50">
                <input type="checkbox" checked={showPlanned} onChange={(e) => setShowPlanned(e.target.checked)} className="form-checkbox h-4 w-4 text-sky-600 border-slate-400 rounded mr-2 focus:ring-sky-500" />
                הצג מתוכננות
            </label>
            <button onClick={() => refetch()} disabled={isLoading || deleteMutation.isLoading || restoreMutation.isLoading} className="p-2.5 rounded-md text-slate-600 hover:text-sky-700 hover:bg-sky-100 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-60 transition" title="רענן רשימה">
                <FiRefreshCw className={`h-5 w-5 ${isLoading || deleteMutation.isLoading || restoreMutation.isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={() => openAddModal('expense')} className="flex items-center px-4 py-2.5 bg-sky-600 text-white rounded-lg shadow hover:bg-sky-700 transition text-sm font-medium" title="הוסף פעולה חדשה">
                <FiPlusCircle className="mr-2 h-5 w-5" /> הוסף
            </button>
        </div>
      </div>
      
      <div className="bg-white shadow-xl rounded-xl overflow-x-auto">
        <table className="min-w-full leading-normal">
          <thead><tr className="border-b-2 border-slate-200 bg-slate-50 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider"><th className="px-5 py-3">תאריך</th><th className="px-5 py-3">תיאור/קטגוריה</th><th className="px-5 py-3">סוג</th><th className="px-5 py-3">סכום</th><th className="px-5 py-3">סטטוס</th><th className="px-5 py-3">פעולות</th></tr></thead>
          <tbody>
            {isLoading && [...Array(7)].map((_, i) => <SkeletonRow key={`skel-${i}`} />)}
            {!isLoading && transactions && transactions.length > 0 ? (
              transactions.map((tx) => {
                const displayDetails = getTransactionDisplayDetails(tx);
                const isDeleted = !!tx.deletedAt;
                return (
                  <tr key={`${tx.type}-${tx.id}`} className={`hover:bg-slate-50 transition-colors ${isDeleted ? 'opacity-50 bg-slate-100 italic' : ''}`}>
                    <td className="px-5 py-3 border-b border-slate-200 text-sm"><p className="text-slate-700 whitespace-no-wrap">{tx.date ? format(parseISO(tx.date), 'dd/MM/yy', { locale: he }) : '-'}</p></td>
                    <td className="px-5 py-3 border-b border-slate-200 text-sm"><div className="flex items-center"><div className="mr-3 p-1.5 bg-slate-100 rounded-full shrink-0">{displayDetails.icon}</div><p className="text-slate-800 whitespace-no-wrap truncate max-w-xs" title={displayDetails.displayDescription}>{displayDetails.displayDescription}</p></div></td>
                    <td className="px-5 py-3 border-b border-slate-200 text-sm"><span className={`px-2.5 py-1 text-xs font-semibold leading-tight rounded-full ${tx.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{tx.type === 'income' ? 'הכנסה' : 'הוצאה'}</span></td>
                    <td className={`px-5 py-3 border-b border-slate-200 text-sm font-semibold text-left ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(tx.amount)}</td>
                    <td className="px-5 py-3 border-b border-slate-200 text-sm"><span className={`text-xs px-2.5 py-1 rounded-full ${isDeleted ? 'bg-gray-200 text-gray-600' : (tx.isProcessed ? 'bg-slate-200 text-slate-600' : 'bg-sky-100 text-sky-700')}`}>{isDeleted ? 'מאורכב' : (tx.isProcessed ? 'בוצע' : 'מתוכנן')}</span></td>
                    <td className="px-5 py-3 border-b border-slate-200 text-sm"><div className="flex items-center space-x-1 space-x-reverse">{!isDeleted ? (<button onClick={() => openEditModal(tx)} title="ערוך" className="text-slate-500 hover:text-sky-600 p-1.5 rounded-md hover:bg-sky-50"><FiEdit className="w-4 h-4"/></button>) : null}{!isDeleted ? (<button onClick={() => handleDelete(tx.type, tx.id)} title="מחק" className="text-slate-500 hover:text-red-600 p-1.5 rounded-md hover:bg-red-50" disabled={deleteMutation.isLoading && deleteMutation.variables?.id === tx.id}><FiTrash2 className="w-4 h-4"/></button>) : null}{isDeleted && (<button onClick={() => handleRestore(tx.type, tx.id)} title="שחזר" className="text-slate-500 hover:text-green-600 p-1.5 rounded-md hover:bg-green-50" disabled={restoreMutation.isLoading && restoreMutation.variables?.id === tx.id}><FiRotateCcw className="w-4 h-4"/></button>)}</div></td>
                  </tr>
                );
            })) : (
              !isLoading && ( <tr> <td colSpan="6" className="text-center py-16 text-slate-500"> <FiRepeat className="mx-auto h-16 w-16 text-slate-400 mb-3"/> <p className="text-lg">אין פעולות להצגה.</p> <p className="text-sm">נסה להוסיף פעולה חדשה או לשנות את המסננים.</p> </td> </tr> )
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <AddTransactionModal
            isOpen={isModalOpen}
            onClose={() => { setIsModalOpen(false); setEditingTransaction(null); }}
            initialType={initialModalType}
            transactionToEdit={editingTransaction} // העבר את הפעולה לעריכה למודל
        />
      )}
    </div>
  );
}

export default TransactionsListPage;    