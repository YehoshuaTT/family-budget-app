// backend/src/routes/dashboard.routes.ts
import { Router, Response } from 'express';
import { AppDataSource } from '../data-source';
import { Income } from '../entity/Income';
import { Expense } from '../entity/Expense';
import { UserSettings } from '../entity/UserSettings';
// Category import might not be directly needed here if using query builder correctly
// import { Category } from '../entity/Category';
import authMiddleware, { AuthenticatedRequest } from '../middleware/auth.middleware';
import { startOfMonth, endOfMonth, format, parseISO } from 'date-fns';
import { IsNull } from 'typeorm'; // Not Between, MoreThanOrEqual, LessThanOrEqual if using query builder date strings

// Import helper functions
import { buildIncomeResponse, buildExpenseResponse } from '../utils/responseBuilders'; // Adjust path if necessary

const router = Router();

// Helper to get current month's start and end dates as 'YYYY-MM-DD' strings
const getCurrentMonthRange = () => {
  const now = new Date();
  const startDate = format(startOfMonth(now), 'yyyy-MM-dd');
  const endDate = format(endOfMonth(now), 'yyyy-MM-dd');
  return { startDate, endDate };
};


// GET /api/dashboard/summary?period=current_month (or specific YYYY-MM)
router.get('/summary', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const period = req.query.period as string || 'current_month';

  let startDateStr: string;
  let endDateStr: string;

  if (period === 'current_month') {
    const range = getCurrentMonthRange();
    startDateStr = range.startDate;
    endDateStr = range.endDate;
  } else if (/\d{4}-\d{2}/.test(period)) {
    const [year, month] = period.split('-').map(Number);
    if (month < 1 || month > 12) {
        return res.status(400).json({ message: "Invalid month in period." });
    }
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = endOfMonth(firstDay);
    startDateStr = format(firstDay, 'yyyy-MM-dd');
    endDateStr = format(lastDay, 'yyyy-MM-dd');
  } else {
    return res.status(400).json({ message: "Invalid period format. Use 'current_month' or 'YYYY-MM'." });
  }
  
  try {
    const incomeRepository = AppDataSource.getRepository(Income);
    const expenseRepository = AppDataSource.getRepository(Expense);
    const userSettingsRepository = AppDataSource.getRepository(UserSettings);

    const totalIncomeResult = await incomeRepository
      .createQueryBuilder("income")
      .select("SUM(income.amount)", "total")
      .where("income.userId = :userId", { userId })
      .andWhere("income.date >= :startDate AND income.date <= :endDate", { startDate: startDateStr, endDate: endDateStr })
      .andWhere("income.deletedAt IS NULL")
      .getRawOne();
    const totalIncome = parseFloat(totalIncomeResult?.total || '0');

    const totalExpensesResult = await expenseRepository
      .createQueryBuilder("expense")
      .select("SUM(expense.amount)", "total")
      .where("expense.userId = :userId", { userId })
      .andWhere("expense.date >= :startDate AND expense.date <= :endDate", { startDate: startDateStr, endDate: endDateStr })
      .andWhere("expense.isProcessed = :isProcessed", { isProcessed: true })
      .andWhere("expense.deletedAt IS NULL")
      .getRawOne();
    const totalExpenses = parseFloat(totalExpensesResult?.total || '0');

    const balance = totalIncome - totalExpenses;

    const settings = await userSettingsRepository.findOneBy({ userId });
    // Ensure settings.monthlyBudgetGoal is treated as number or null
    const monthlyBudgetGoal = (settings && settings.monthlyBudgetGoal !== null) ? parseFloat(settings.monthlyBudgetGoal as any) : null;
    
    let budgetStatus = null;
    if (monthlyBudgetGoal !== null && monthlyBudgetGoal > 0) {
        budgetStatus = {
            goal: monthlyBudgetGoal,
            spent: totalExpenses,
            remaining: monthlyBudgetGoal - totalExpenses,
            percentage: parseFloat(((totalExpenses / monthlyBudgetGoal) * 100).toFixed(2))
        };
        // Handle case where budget goal is 0 to avoid division by zero if that's possible
        if (monthlyBudgetGoal === 0 && totalExpenses > 0) budgetStatus.percentage = 100;
        else if (monthlyBudgetGoal === 0 && totalExpenses === 0) budgetStatus.percentage = 0;

    } else if (monthlyBudgetGoal === 0) { // Explicitly handle 0 budget goal
        budgetStatus = {
            goal: 0,
            spent: totalExpenses,
            remaining: -totalExpenses, // Or 0 if we consider 0 goal means no tracking
            percentage: totalExpenses > 0 ? 100 : 0 // Or some other indicator
        };
    }


    res.json({
      period: { startDate: startDateStr, endDate: endDateStr },
      totalIncome,
      totalExpenses,
      balance,
      budget: budgetStatus,
    });

  } catch (error: any) {
    console.error('Error fetching dashboard summary:', error);
    res.status(500).json({ message: `Server error: ${error.message || 'Failed to fetch summary'}` });
  }
});


// GET /api/dashboard/recent-transactions?limit=5
router.get('/recent-transactions', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const limit = parseInt(req.query.limit as string, 10) || 5;
  if (isNaN(limit) || limit <= 0) {
      return res.status(400).json({message: "Invalid limit parameter."});
  }

  try {
    const incomeRepository = AppDataSource.getRepository(Income);
    const expenseRepository = AppDataSource.getRepository(Expense);

    const recentIncomes = await incomeRepository.find({
      where: { userId, deletedAt: IsNull() },
      order: { date: 'DESC', createdAt: 'DESC' },
      take: limit,
      relations: ['category'],
    });

    const recentExpenses = await expenseRepository.find({
      where: { userId, isProcessed: true, deletedAt: IsNull() },
      order: { date: 'DESC', createdAt: 'DESC' },
      take: limit,
      relations: ['subcategory', 'subcategory.category'],
    });

    const transactions: any[] = []; // Use any[] for mixed types or define a common transaction interface

    recentIncomes.forEach(i => {
        const incomeRes = buildIncomeResponse(i);
        if (incomeRes) transactions.push({ ...incomeRes, transactionType: 'income' });
    });
    recentExpenses.forEach(e => {
        const expenseRes = buildExpenseResponse(e);
        if (expenseRes) transactions.push({ ...expenseRes, transactionType: 'expense' });
    });

    // Sort by date (primary) and then by createdAt (secondary) for items on the same date
    transactions.sort((a, b) => {
        const dateComparison = parseISO(b.date).getTime() - parseISO(a.date).getTime();
        if (dateComparison !== 0) return dateComparison;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    
    res.json(transactions.slice(0, limit));

  } catch (error: any) {
    console.error('Error fetching recent transactions:', error);
    res.status(500).json({ message: `Server error: ${error.message || 'Failed to fetch recent transactions'}` });
  }
});


// GET /api/dashboard/expense-distribution?period=current_month
router.get('/expense-distribution', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const period = req.query.period as string || 'current_month';

  let startDateStr: string;
  let endDateStr: string;

  if (period === 'current_month') {
    const range = getCurrentMonthRange();
    startDateStr = range.startDate;
    endDateStr = range.endDate;
  } else if (/\d{4}-\d{2}/.test(period)) {
    const [year, month] = period.split('-').map(Number);
    if (month < 1 || month > 12) {
        return res.status(400).json({ message: "Invalid month in period." });
    }
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = endOfMonth(firstDay);
    startDateStr = format(firstDay, 'yyyy-MM-dd');
    endDateStr = format(lastDay, 'yyyy-MM-dd');
  } else {
    return res.status(400).json({ message: "Invalid period format. Use 'current_month' or 'YYYY-MM'." });
  }

  try {
    const distribution = await AppDataSource.getRepository(Expense)
      .createQueryBuilder("expense")
      .innerJoin("expense.subcategory", "subcategory") // Use innerJoin if expense MUST have subcategory
      .innerJoin("subcategory.category", "category")
      .select("category.id", "categoryId")
      .addSelect("category.name", "categoryName")
      .addSelect("SUM(expense.amount)", "totalAmount")
      .where("expense.userId = :userId", { userId })
      .andWhere("expense.date >= :startDate AND expense.date <= :endDate", { startDate: startDateStr, endDate: endDateStr })
      .andWhere("expense.isProcessed = :isProcessed", { isProcessed: true })
      .andWhere("expense.deletedAt IS NULL")
      .andWhere("category.archived = :archived", {archived: false})
      .andWhere("category.type = :type", {type: 'expense'}) // Ensure only expense categories
      .groupBy("category.id, category.name")
      .orderBy("SUM(expense.amount)", "DESC") // Order by totalAmount DESC
      .getRawMany();
    
    const formattedDistribution = distribution.map(item => ({
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        totalAmount: parseFloat(item.totalAmount || '0')
    }));

    res.json(formattedDistribution);

  } catch (error: any) {
    console.error('Error fetching expense distribution:', error);
    res.status(500).json({ message: `Server error: ${error.message || 'Failed to fetch expense distribution'}` });
  }
});

export default router;