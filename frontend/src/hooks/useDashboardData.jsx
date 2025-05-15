// src/hooks/useDashboardData.jsx
import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/apiClient'; // מופע ה-Axios שלנו

const fetchDashboardSummary = async (period = 'current_month') => {
  const { data } = await apiClient.get(`/dashboard/summary?period=${period}`);
  return data;
};

const fetchRecentTransactions = async (limit = 5) => {
  const { data } = await apiClient.get(`/dashboard/recent-transactions?limit=${limit}`);
  return data;
};

const fetchExpenseDistribution = async (period = 'current_month') => {
  const { data } = await apiClient.get(`/dashboard/expense-distribution?period=${period}`);
  return data;
};

export const useDashboardSummary = (period = 'current_month') => {
  return useQuery({
    queryKey: ['dashboardSummary', period], // מפתח ייחודי לשאילתה, כולל התקופה
    queryFn: () => fetchDashboardSummary(period),
    // אפשר להוסיף כאן אפשרויות ספציפיות לשאילתה הזו, כמו enabled, staleTime, וכו'
  });
};

export const useRecentTransactions = (limit = 5) => {
  return useQuery({
    queryKey: ['recentTransactions', limit],
    queryFn: () => fetchRecentTransactions(limit),
  });
};

export const useExpenseDistribution = (period = 'current_month') => {
  return useQuery({
    queryKey: ['expenseDistribution', period],
    queryFn: () => fetchExpenseDistribution(period),
  });
};