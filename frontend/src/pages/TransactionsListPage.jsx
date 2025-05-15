// src/pages/TransactionsListPage.jsx
import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import apiClient from '../api/apiClient';
import { format, parseISO } from 'date-fns';
import { he } from 'date-fns/locale';
import { FiEdit, FiTrash2, FiRotateCcw, FiFilter, FiCalendar, FiDollarSign, FiCreditCard, FiAlertTriangle, FiPlusCircle, FiRefreshCw } from 'react-icons/fi';
import AddTransactionModal from '../components/transactions/AddTransactionModal'; // המודל שיצרנו
// import { useAuth } from '../contexts/AuthContext'; // לא בהכרח נחוץ כאן אם ה-API מאובטח

const fetchTransactions = async ({ queryKey }) => {
  // const [_key, { filters }] = queryKey; // אם יהיו פילטרים בעתיד
  // TODO: Add filtering capabilities to API calls if needed (e.g., date range, type)
  const [incomesRes, expensesRes] = await Promise.all([
    apiClient.get('/incomes'), // Assuming this returns all incomes for the user
    apiClient.get('/expenses') // Assuming this returns all expenses (including planned)
  ]);

  const incomes = incomesRes.data.map(inc => ({ ...inc, type: 'income', transactionDate: inc.date }));
  const expenses = expensesRes.data.map(exp => ({ ...exp, type: 'expense', transactionDate: exp.date }));
  
  const allTransactions = [...incomes, ...expenses];
  allTransactions.sort((a, b) => parseISO(b.transactionDate).getTime() - parseISO(a.transactionDate).getTime());
  return allTransactions;
};

// Helper function to format currency (נשתמש באותו אחד מהדשבורד, אולי כדאי להוציא ל-utils)
const formatCurrency = (amount, currency = '₪') => {
    if (amount === null || amount === undefined || isNaN(parseFloat(amount))) return `0.00 ${currency}`;
    return `${parseFloat(amount).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
};

const SkeletonRow = () => (
    <tr className="animate-pulse">
        <td className="px-5 py-4 border-b border-slate-200 bg-white text-sm"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
        <td className="px-5 py-4 border-b border-slate-200 bg-white text-sm"><div className="h-4 bg-slate-200 rounded w-32"></div></td>
        <td className="px-5 py-4 border-b border-slate-200 bg-white text-sm"><div className="h-4 bg-slate-200 rounded w-24"></div></td>
        <td className="px-5 py-4 border-b border-slate-200 bg-white text-sm"><div className="h-4 bg-slate-200 rounded w-16"></div></td>
        <td className="px-5 py-4 border-b border-slate-200 bg-white text-sm"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
        <td className="px-5 py-4 border-b border-slate-200 bg-white text-sm"><div className="h-8 w-20 bg-slate-200 rounded"></div></td>
    </tr>
);


function TransactionsListPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null); // יחזיק את הפעולה לעריכה
  const [initialModalType, setInitialModalType] = useState('expense');


  // TODO: Add state for filters (date range, type, category etc.)
  // const [filters, setFilters] = useState({ dateFrom: null, dateTo: null, type: 'all' });

  const { data: transactions, isLoading, error, refetch } = useQuery({
    queryKey: ['transactions'], // Add filters to queryKey if they are used: ['transactions', filters]
    queryFn: fetchTransactions,
  });

  const deleteMutation = useMutation({
    mutationFn: ({ type, id }) => {
      const endpoint = type === 'income' ? `/incomes/${id}` : `/expenses/${id}`;
      return apiClient.delete(endpoint);
    },
    onSuccess: (data, variables) => {
      console.log(`${variables.type} ID ${variables.id} deleted successfully`);
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] }); // Invalidate dashboard data too
      queryClient.invalidateQueries({ queryKey: ['recentTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['expenseDistribution'] });
    },
    onError: (error, variables) => {
      console.error(`Error deleting ${variables.type} ID ${variables.id}:`, error);
      alert(`Failed to delete ${variables.type}.`); // Simple error display
    }
  });

  const handleDelete = (type, id) => {
    if (window.confirm(`האם אתה בטוח שברצונך למחוק ${type === 'income' ? 'הכנסה' : 'הוצאה'} זו?`)) {
      deleteMutation.mutate({ type, id });
    }
  };
  
  const openEditModal = (transaction) => {
      setInitialModalType(transaction.type); // או transaction.transactionType, תלוי איך הוא מגיע
      setEditingTransaction(transaction); // נצטרך להעביר את זה ל-AddTransactionModal
      setIsModalOpen(true);
  };
  
  const openAddModal = (type = 'expense') => {
    setEditingTransaction(null); // ודא שאין פעולה בעריכה
    setInitialModalType(type);
    setIsModalOpen(true);
  };

  const getTransactionDisplayDetails = (transaction) => {
    if (transaction.type === 'income') {
      return {
        categoryDisplay: transaction.category?.name || 'לא מסווג',
        icon: <FiDollarSign className="text-green-500" />
      };
    } else { // expense
      let description = transaction.description || transaction.subcategory?.name || 'לא מסווג';
      if (transaction.expenseType === 'recurring_instance') description = `(ח) ${description}`;
      if (transaction.expenseType === 'installment_instance') description = `(ת) ${description}`;
      return {
        categoryDisplay: description,
        icon: <FiCreditCard className="text-red-500" />
      };
    }
  };


  if (error) return (
    <div className="flex flex-col items-center justify-center h-64 text-red-600 bg-red-50 p-4 rounded-md">
        <FiAlertTriangle className="h-12 w-12 mb-4"/>
        <p className="text-xl font-semibold">שגיאה בטעינת הפעולות</p>
        <p>{error.message}</p>
        <button onClick={() => refetch()} className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">נסה שוב</button>
    </div>
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-slate-800">כל הפעולות</h1>
        <div className="flex gap-2">
            <button 
                onClick={() => refetch()} 
                disabled={isLoading || deleteMutation.isLoading}
                className="p-2 rounded-md text-slate-600 hover:text-sky-700 hover:bg-sky-100 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-60 transition"
                title="רענן רשימה"
            >
                <FiRefreshCw className={`h-5 w-5 ${isLoading || deleteMutation.isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
                onClick={() => openAddModal('expense')}
                className="flex items-center px-4 py-2 bg-sky-600 text-white rounded-lg shadow hover:bg-sky-700 transition"
                title="הוסף פעולה חדשה"
            >
                <FiPlusCircle className="mr-2 h-5 w-5" />
                הוסף פעולה
            </button>
        </div>
      </div>

      {/* TODO: Add Filter UI components here (date range, type dropdown, category dropdown) */}
      
      <div className="bg-white shadow-xl rounded-xl overflow-x-auto">
        <table className="min-w-full leading-normal">
          <thead>
            <tr className="border-b-2 border-slate-200 bg-slate-50 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
              <th className="px-5 py-3">תאריך</th>
              <th className="px-5 py-3">תיאור/קטגוריה</th>
              <th className="px-5 py-3">סוג</th>
              <th className="px-5 py-3 text-right">סכום</th>
              <th className="px-5 py-3">סטטוס</th>
              <th className="px-5 py-3">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && [...Array(5)].map((_, i) => <SkeletonRow key={i} />)}
            {!isLoading && transactions && transactions.length > 0 ? (
              transactions.map((tx) => {
                const displayDetails = getTransactionDisplayDetails(tx);
                return (
                  <tr key={`${tx.type}-${tx.id}`} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4 border-b border-slate-200 bg-white text-sm">
                      <p className="text-slate-900 whitespace-no-wrap">
                        {tx.date ? format(parseISO(tx.date), 'dd/MM/yyyy', { locale: he }) : '-'}
                      </p>
                    </td>
                    <td className="px-5 py-4 border-b border-slate-200 bg-white text-sm">
                      <div className="flex items-center">
                        <div className="mr-3 p-1.5 bg-slate-100 rounded-full">{displayDetails.icon}</div>
                        <p className="text-slate-900 whitespace-no-wrap" title={tx.description || displayDetails.categoryDisplay}>
                          {tx.description || displayDetails.categoryDisplay}
                        </p>
                      </div>
                    </td>
                    <td className="px-5 py-4 border-b border-slate-200 bg-white text-sm">
                      <span className={`px-2 py-1 text-xs font-semibold leading-tight rounded-full ${
                        tx.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {tx.type === 'income' ? 'הכנסה' : 'הוצאה'}
                      </span>
                    </td>
                    <td className={`px-5 py-4 border-b border-slate-200 bg-white text-sm text-right font-semibold ${
                        tx.type === 'income' ? 'text-green-600' : 'text-red-600'
                      }`}>
                      {formatCurrency(tx.amount)}
                    </td>
                    <td className="px-5 py-4 border-b border-slate-200 bg-white text-sm">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${tx.isProcessed ? 'bg-slate-200 text-slate-600' : 'bg-sky-100 text-sky-700'}`}>
                            {tx.isProcessed ? 'בוצע' : 'מתוכנן'}
                        </span>
                        {tx.deletedAt && <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-gray-300 text-gray-700">מאורכב</span>}
                    </td>
                    <td className="px-5 py-4 border-b border-slate-200 bg-white text-sm">
                      <div className="flex items-center space-x-2 space-x-reverse">
                        {/* כפתור עריכה (יפתח את המודל עם הנתונים) */}
                        <button onClick={() => openEditModal(tx)} title="ערוך" className="text-slate-500 hover:text-sky-600 p-1">
                            <FiEdit className="w-4 h-4"/>
                        </button>
                        {!tx.deletedAt && (
                            <button onClick={() => handleDelete(tx.type, tx.id)} title="מחק" className="text-slate-500 hover:text-red-600 p-1" disabled={deleteMutation.isLoading && deleteMutation.variables?.id === tx.id}>
                                <FiTrash2 className="w-4 h-4"/>
                            </button>
                        )}
                        {tx.deletedAt && (
                            <button onClick={() => alert('TODO: Restore transaction')} title="שחזר" className="text-slate-500 hover:text-green-600 p-1"> {/* TODO */}
                                <FiRotateCcw className="w-4 h-4"/>
                            </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
            })) : (
              !isLoading && (
                <tr>
                  <td colSpan="6" className="text-center py-10 text-slate-500">
                    אין פעולות להצגה. נסה להוסיף פעולה חדשה!
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <AddTransactionModal
            isOpen={isModalOpen}
            onClose={() => { setIsModalOpen(false); setEditingTransaction(null); }}
            initialType={initialModalType}
            // transactionToEdit={editingTransaction} // נצטרך להתאים את המודל לקבל את זה
        />
      )}
    </div>
  );
}

export default TransactionsListPage;