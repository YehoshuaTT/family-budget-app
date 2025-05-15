// src/pages/TransactionsListPage.jsx
import React from 'react';

const TransactionsListPage = () => {
  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-800 mb-6">כל הפעולות</h1>
      <div className="bg-white shadow-xl rounded-xl p-6">
        <p className="text-slate-600">(כאן תוצג רשימת כל ההכנסות וההוצאות עם סינון ומיון)</p>
        {/* טבלה או רשימת קארדים תבוא כאן */}
      </div>
    </div>
  );
};

export default TransactionsListPage;