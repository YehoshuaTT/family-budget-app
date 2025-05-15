// src/pages/DashboardPage.jsx
import React, { useState, useMemo, useEffect } from 'react'; // הוסף useEffect
// import Header from '../components/layout/Header'; // Header מגיע מ-MainLayout
import AddTransactionModal from '../components/transactions/AddTransactionModal';
import { FiPlusCircle, FiTrendingDown, FiPieChart, FiClipboard, FiRefreshCw, FiDollarSign, FiCreditCard, FiCalendar, FiAlertTriangle, FiChevronRight, FiChevronLeft } from 'react-icons/fi';
import { useDashboardSummary, useRecentTransactions, useExpenseDistribution } from '../hooks/useDashboardData';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Sector } from 'recharts'; // הסר Legend אם לא בשימוש
import { format, parseISO, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns'; // הוסף פונקציות חסרות
import { he } from 'date-fns/locale';
import { useAuth } from '../contexts/AuthContext'; // לגישה לפרטי המשתמש

// Helper function to format currency
const formatCurrency = (amount, currency = '₪') => {
  if (amount === null || amount === undefined || isNaN(parseFloat(amount))) return `0.00 ${currency}`;
  return `${parseFloat(amount).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
};

// For Pie Chart active sector custom shape
const renderActiveShape = (props) => {
  const RADIAN = Math.PI / 180;
  const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
  if (!payload || value === undefined) return null;

  const sin = Math.sin(-RADIAN * midAngle);
  const cos = Math.cos(-RADIAN * midAngle);
  const sx = cx + (outerRadius + 5) * cos;
  const sy = cy + (outerRadius + 5) * sin;
  const mx = cx + (outerRadius + 15) * cos;
  const my = cy + (outerRadius + 15) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 18;
  const ey = my;
  const textAnchor = cos >= 0 ? 'start' : 'end';

  return (
    <g>
      <text x={cx} y={cy} dy={8} textAnchor="middle" fill={fill} className="text-sm font-semibold">
        {payload.categoryName}
      </text>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx}
        cy={cy}
        startAngle={startAngle}
        endAngle={endAngle}
        innerRadius={outerRadius + 4}
        outerRadius={outerRadius + 8}
        fill={fill}
      />
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
      <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
      <text x={ex + (cos >= 0 ? 1 : -1) * 8} y={ey} textAnchor={textAnchor} fill="#333" className="text-xs">
        {`${formatCurrency(value)}`}
      </text>
      <text x={ex + (cos >= 0 ? 1 : -1) * 8} y={ey} dy={14} textAnchor={textAnchor} fill="#999" className="text-xs">
        {`(${(percent * 100).toFixed(1)}%)`}
      </text>
    </g>
  );
};

const SkeletonLoader = ({ className = "h-8 bg-slate-200 rounded w-3/4" }) => (
  <div className={`animate-pulse ${className}`}></div>
);


function DashboardPage() {
  const { user } = useAuth(); // קבלת המשתמש מה-AuthContext
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [initialTransactionType, setInitialTransactionType] = useState('expense');
  const [activePieIndex, setActivePieIndex] = useState(0);
  
  // State for current period (YYYY-MM format or 'current_month')
  const [selectedPeriod, setSelectedPeriod] = useState('current_month');

  const { data: summaryData, isLoading: isLoadingSummary, error: errorSummary, refetch: refetchSummary } = useDashboardSummary(selectedPeriod);
  const { data: recentTransactionsData, isLoading: isLoadingRecent, error: errorRecent, refetch: refetchRecent } = useRecentTransactions(5);
  const { data: expenseDistributionData, isLoading: isLoadingDistribution, error: errorDistribution, refetch: refetchDistribution } = useExpenseDistribution(selectedPeriod);

  // אפקט לרענון נתונים כשהדף נטען או כשהתקופה משתנה
  useEffect(() => {
    // React Query מטפל ברענון אוטומטי כשה-queryKey משתנה (כלומר selectedPeriod),
    // אז אין צורך לקרוא ל-refetch כאן באופן מפורש אלא אם יש צורך מיוחד.
    // refetchSummary(); 
    // refetchRecent(); // Recent transactions might not need to change with period
    // refetchDistribution();
  }, [selectedPeriod]); // הסר את פונקציות ה-refetch מכאן אם לא נחוץ

  const onPieEnter = (_, index) => {
    setActivePieIndex(index);
  };

  const PIE_CHART_COLORS = ['#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#6366F1', '#EC4899'];

  const isLoading = isLoadingSummary || isLoadingRecent || isLoadingDistribution;

  const handleRefreshAll = () => {
    if (isLoading) return;
    refetchSummary();
    refetchRecent();
    refetchDistribution();
  };

  const openAddModal = (type = 'expense') => {
    setInitialTransactionType(type);
    setIsAddModalOpen(true);
  };
  
  const getTransactionIcon = (transaction) => {
    if (!transaction) return <FiDollarSign className="h-5 w-5 text-slate-400" />;
    if (transaction.transactionType === 'income') return <FiDollarSign className="text-green-500 h-5 w-5" />;
    return <FiCreditCard className="text-red-500 h-5 w-5" />;
  };

  const chartData = useMemo(() => {
    if (!expenseDistributionData || expenseDistributionData.length === 0) return [];
    return expenseDistributionData.map(item => ({
      name: item.categoryName,
      value: item.totalAmount,
      categoryName: item.categoryName,
      totalAmount: item.totalAmount,
    }));
  }, [expenseDistributionData]);
  
  // פונקציות לשינוי חודש
  const handlePreviousMonth = () => {
    setSelectedPeriod(prevPeriod => {
        if (prevPeriod === 'current_month') {
            return format(subMonths(new Date(), 1), 'yyyy-MM');
        }
        const current = parseISO(prevPeriod + '-01'); // Convert YYYY-MM to Date
        return format(subMonths(current, 1), 'yyyy-MM');
    });
  };

  const handleNextMonth = () => {
      setSelectedPeriod(prevPeriod => {
          if (prevPeriod === 'current_month') {
              // Cannot go to next month from "current_month" if it means future
              // Or decide how to handle this (e.g. disable button, or allow viewing empty future months)
              // For now, let's make "current_month" the latest accessible.
              // To allow going to next, you'd calculate it.
              const nextMonthDate = addMonths(new Date(), 1);
              // Prevent going past current real month if that's the logic
              // if (nextMonthDate > new Date() && prevPeriod !== format(addMonths(new Date(), -1), 'yyyy-MM')) {
              //   return 'current_month';
              // }
              return format(nextMonthDate, 'yyyy-MM');
          }
          const current = parseISO(prevPeriod + '-01');
          const nextMonthDate = addMonths(current, 1);
          
          // Check if next month is current month or future
          const now = new Date();
          const startOfCurrentRealMonth = startOfMonth(now);
          if (nextMonthDate >= startOfCurrentRealMonth) {
              return 'current_month';
          }
          return format(nextMonthDate, 'yyyy-MM');
      });
  };
  
  const isNextMonthDisabled = () => {
      if (selectedPeriod === 'current_month') return true; // Disable if current month is selected
      // Add more complex logic if needed to prevent going too far into the future
      return false;
  };


  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
            סקירה חודשית
            </h1>
            <span className="text-md text-slate-500">
                ({selectedPeriod === 'current_month' ? 'חודש נוכחי' : format(parseISO(selectedPeriod + '-01'), 'MMMM yyyy', { locale: he })})
            </span>
        </div>
        <div className="flex items-center gap-2">
            <button onClick={handlePreviousMonth} className="p-2 rounded-md hover:bg-slate-200 transition"><FiChevronRight  className="h-5 w-5 text-slate-600" /></button> {/* RTL: Right arrow for previous */}
            <button onClick={handleNextMonth} disabled={isNextMonthDisabled()} className="p-2 rounded-md hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition"><FiChevronLeft className="h-5 w-5 text-slate-600" /></button> {/* RTL: Left arrow for next */}
            <button
            onClick={handleRefreshAll}
            disabled={isLoading}
            className="p-2 rounded-md text-slate-600 hover:text-sky-700 hover:bg-sky-100 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-60 transition"
            title="רענן נתונים"
            >
            <FiRefreshCw className={`h-6 w-6 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
        </div>
      </div>

      <button
        onClick={() => openAddModal('expense')}
        title="הוסף פעולה חדשה"
        className="fixed bottom-8 left-8 z-40 flex items-center justify-center h-14 w-14 bg-sky-600 text-white rounded-full shadow-xl hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 transition duration-150 ease-in-out active:bg-sky-800"
      >
        <FiPlusCircle className="h-7 w-7" />
      </button>

      {/* Grid for Widgets (כמו קודם, ללא שינוי מהגרסה הקודמת עם הנתונים) */}
      {/* ... (הדבק כאן את כל קוד הגריד של הווידג'טים מההודעה הקודמת שלך) ... */}
      {/* זה החלק שמתחיל ב: <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"> */}
      {/* ומסתיים לפני: <AddTransactionModal ... /> */}

       {/* Grid for Widgets - From previous response */}
       <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        
        {/* Widget: Summary */}
        <div className="bg-white overflow-hidden shadow-xl rounded-xl p-6 xl:col-span-2">
          <div className="flex items-center mb-4">
            <div className="p-3 rounded-full bg-sky-100 text-sky-600">
              <FiClipboard className="h-6 w-6" />
            </div>
            <h3 className="ml-3 text-xl font-semibold text-slate-700">סיכום תקופתי</h3>
          </div>
          {isLoadingSummary ? ( /* ... Skeleton ... */ <div className="space-y-3 mt-2"><SkeletonLoader className="h-6 w-3/4" /><SkeletonLoader className="h-6 w-2/3" /><SkeletonLoader className="h-6 w-1/2" /><SkeletonLoader className="h-2.5 w-full mt-3" /></div>
          ) : errorSummary ? ( /* ... Error ... */  <div className="flex items-center text-red-600 p-3 bg-red-50 rounded-md"><FiAlertTriangle className="h-5 w-5 mr-2"/> שגיאה בטעינת הסיכום.</div>
          ) : summaryData ? (
            <div className="space-y-3">
              {/* ... תוכן הווידג'ט summary ... */}
              <div className="flex justify-between items-baseline"><span className="text-slate-600 text-md">הכנסות:</span><span className="font-bold text-2xl text-green-600">{formatCurrency(summaryData.totalIncome)}</span></div>
              <div className="flex justify-between items-baseline"><span className="text-slate-600 text-md">הוצאות:</span><span className="font-bold text-2xl text-red-600">{formatCurrency(summaryData.totalExpenses)}</span></div>
              <hr className="my-2 border-slate-200"/>
              <div className="flex justify-between items-baseline"><span className="text-slate-600 text-md">יתרה:</span><span className={`font-bold text-2xl ${summaryData.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(summaryData.balance)}</span></div>
              {summaryData.budget && (summaryData.budget.goal !== null && summaryData.budget.goal !== undefined) ? ( <div className="pt-3"> <div className="flex justify-between text-sm text-slate-500 mb-1"> <span>תקציב חודשי: {formatCurrency(summaryData.budget.goal)}</span> {summaryData.budget.goal > 0 && <span>({summaryData.budget.percentage}%)</span>} </div> <div className="w-full bg-slate-200 rounded-full h-3.5 overflow-hidden"> <div className={`h-3.5 rounded-full transition-all duration-500 ease-out ${summaryData.budget.percentage >= 100 ? 'bg-red-500' : summaryData.budget.percentage >= 75 ? 'bg-orange-400' : 'bg-green-500'}`} style={{ width: `${summaryData.budget.goal > 0 ? Math.min(summaryData.budget.percentage, 100) : (summaryData.budget.spent > 0 ? 100 : 0)}%` }} ></div> </div> {summaryData.budget.goal > 0 && ( <p className={`text-sm mt-1 font-medium ${summaryData.budget.remaining >=0 ? 'text-green-700' : 'text-red-700'}`}> {summaryData.budget.remaining >=0 ? `נותרו ${formatCurrency(summaryData.budget.remaining)}` : `חריגה של ${formatCurrency(Math.abs(summaryData.budget.remaining))}`} </p> )} </div> ) : ( <p className="text-sm text-slate-400 pt-3">(לא הוגדר יעד תקציב חודשי)</p> )}
            </div>
          ) : <p className="text-slate-500">אין נתונים להצגה.</p>}
        </div>

        {/* Widget: Recent Transactions */}
        <div className="bg-white overflow-hidden shadow-xl rounded-xl p-6">
          {/* ... תוכן הווידג'ט recent transactions ... */}
          <div className="flex items-center mb-4"><div className="p-3 rounded-full bg-amber-100 text-amber-600"><FiTrendingDown className="h-6 w-6" /></div><h3 className="ml-3 text-xl font-semibold text-slate-700">פעולות אחרונות</h3></div>
          {isLoadingRecent ? ( <div className="space-y-4 mt-2">{[...Array(3)].map((_, i) => <div key={i} className="flex items-center space-x-3"><SkeletonLoader className="h-10 w-10 rounded-full bg-slate-200"/><div className="flex-1 space-y-2"><SkeletonLoader className="h-4 w-3/4"/><SkeletonLoader className="h-3 w-1/2"/></div><SkeletonLoader className="h-5 w-16"/></div>)}</div>
          ) : errorRecent ? ( <div className="flex items-center text-red-600 p-3 bg-red-50 rounded-md"><FiAlertTriangle className="h-5 w-5 mr-2"/> שגיאה בטעינת פעולות.</div>
          ) : recentTransactionsData && recentTransactionsData.length > 0 ? (
            <ul className="space-y-3 -mr-2">
              {recentTransactionsData.map((tx) => ( <li key={`${tx.transactionType}-${tx.id}`} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-b-0"> <div className="flex items-center min-w-0"> <span className="p-2.5 rounded-full bg-slate-100 mr-3 shrink-0"> {getTransactionIcon(tx)} </span> <div className="min-w-0"> <p className="text-sm font-medium text-slate-800 truncate" title={tx.description || (tx.subcategory ? tx.subcategory.name : tx.category ? tx.category.name : 'לא מסווג')}> {tx.description || (tx.subcategory ? tx.subcategory.name : tx.category ? tx.category.name : 'לא מסווג')} </p> <p className="text-xs text-slate-500 flex items-center"> <FiCalendar className="w-3 h-3 ml-1 text-slate-400" /> {tx.date ? format(parseISO(tx.date), 'd בMMMM, yyyy', { locale: he }) : 'אין תאריך'} </p> </div> </div> <span className={`text-sm font-semibold whitespace-nowrap ${tx.transactionType === 'income' ? 'text-green-600' : 'text-red-600'}`}> {tx.transactionType === 'income' ? '+' : '-'} {formatCurrency(tx.amount, '')} </span> </li> ))}
            </ul>
          ) : ( <p className="text-slate-500 py-8 text-center">אין פעולות אחרונות להצגה.</p> )}
        </div>
        
        {/* Widget: Expense Distribution Chart */}
        <div className="bg-white overflow-hidden shadow-xl rounded-xl p-6">
          {/* ... תוכן הווידג'ט chart ... */}
          <div className="flex items-center mb-4"><div className="p-3 rounded-full bg-purple-100 text-purple-600"><FiPieChart className="h-6 w-6" /></div><h3 className="ml-3 text-xl font-semibold text-slate-700">התפלגות הוצאות</h3></div>
          {isLoadingDistribution ? ( <div className="h-64 flex items-center justify-center"><SkeletonLoader className="h-48 w-48 rounded-full bg-slate-200" /></div>
          ) : errorDistribution ? ( <div className="flex items-center text-red-600 p-3 bg-red-50 rounded-md h-64 justify-center"><FiAlertTriangle className="h-5 w-5 mr-2"/> שגיאה בטעינת גרף.</div>
          ) : chartData && chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}> <PieChart> <Pie activeIndex={activePieIndex} activeShape={renderActiveShape} data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} fill="#8884d8" dataKey="value" nameKey="name" onMouseEnter={onPieEnter} paddingAngle={1} > {chartData.map((entry, index) => ( <Cell key={`cell-${index}`} fill={PIE_CHART_COLORS[index % PIE_CHART_COLORS.length]} className="focus:outline-none" /> ))} </Pie> <Tooltip formatter={(value) => formatCurrency(value)} /> </PieChart> </ResponsiveContainer>
          ) : ( <p className="text-slate-500 h-64 flex items-center justify-center">אין נתוני הוצאות להצגה בגרף.</p> )}
        </div>
      </div> {/* End of Grid */}


      <AddTransactionModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        initialType={initialTransactionType}
      />
    </>
  );
}

export default DashboardPage;