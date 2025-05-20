// backend/src/entity/index.ts
import { User } from './User';
import { Category } from './Category';
import { Subcategory } from './Subcategory';
import { Income } from './Income';
import { Expense } from './Expense';
import { UserSettings } from './UserSettings';
import { RecurringExpenseDefinition } from './RecurringExpenseDefinition'; // New
import { InstallmentTransaction } from './InstallmentTransaction';     // New
import { Budget } from './Budget'; // <-- הוסף
import { BudgetProfile } from './BudgetProfile';
import { RecurringIncomeDefinition } from './RecurringIncomeDefinition'; // New

export const ALL_ENTITIES = [
  User,
  Category,
  Subcategory,
  Income,
  Expense,
  UserSettings,
  RecurringExpenseDefinition, // Add new
  InstallmentTransaction ,
  Budget,
  BudgetProfile,
  RecurringIncomeDefinition // Add new
];