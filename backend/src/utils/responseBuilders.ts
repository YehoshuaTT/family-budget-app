// backend/src/utils/responseBuilders.ts
import { Income } from '../entity/Income';
import { Expense } from '../entity/Expense';
// Category and Subcategory might be implicitly handled if already loaded on the entity relations

export const buildIncomeResponse = (income: Income | null) => {
  if (!income) return null;
  return {
    id: income.id,
    amount: parseFloat(income.amount as any),
    date: income.date,
    description: income.description,
    category: income.category ? {
        id: income.category.id,
        name: income.category.name,
        type: income.category.type
    } : null,
    createdAt: income.createdAt,
    updatedAt: income.updatedAt,
    deletedAt: income.deletedAt
  };
};

export const buildExpenseResponse = (expense: Expense | null) => {
  if (!expense) return null;
  return {
    id: expense.id,
    amount: parseFloat(expense.amount as any),
    date: expense.date,
    description: expense.description,
    paymentMethod: expense.paymentMethod,
    expenseType: expense.expenseType,
    parentId: expense.parentId,
    isProcessed: expense.isProcessed,
    subcategory: expense.subcategory ? {
        id: expense.subcategory.id,
        name: expense.subcategory.name,
        category: expense.subcategory.category ? {
            id: expense.subcategory.category.id,
            name: expense.subcategory.category.name,
            type: expense.subcategory.category.type,
        } : null
    } : null,
    createdAt: expense.createdAt,
    updatedAt: expense.updatedAt,
    deletedAt: expense.deletedAt
  };
};