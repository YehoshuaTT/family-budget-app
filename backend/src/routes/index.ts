// backend/src/routes/index.ts
import { Router } from 'express';
import authRoutes from './auth.routes';
import categoryRoutes from './category.routes';
import incomeRoutes from './income.routes';
import expenseRoutes from './expense.routes';
import userSettingsRoutes from './userSettings.routes';
import dashboardRoutes from './dashboard.routes';
import recurringDefinitionRoutes from './recurringDefinition.routes';
import installmentTransactionRoutes from './installmentTransaction.routes';
import budgetProfileRoutes from './budgetProfile.routes';
import budgetRoutes from './budget.routes';
import userRoutes from './user.routes'; // <<< הוסף ייבוא זה
import recurringIncomeRoutes from './recurringIncome.routes'; // <<< הוסף

// ...

// ייבא middleware אם יש לך middleware גלובלי לכל ה-API (כמו auth.middleware)
// import authMiddleware from '../middleware/auth.middleware';

const mainRouter = Router();

// כאן אתה יכול להחיל middleware שמשותף לכל הראוטים תחת /api, אם יש
// mainRouter.use(someGlobalApiMiddleware);

mainRouter.use('/auth', authRoutes);
mainRouter.use('/user-settings', userSettingsRoutes);
mainRouter.use('/dashboard', dashboardRoutes);
mainRouter.use('/categories', categoryRoutes);
mainRouter.use('/incomes', incomeRoutes);
mainRouter.use('/expenses', expenseRoutes);
mainRouter.use('/recurring-definitions', recurringDefinitionRoutes);
mainRouter.use('/installment-transactions', installmentTransactionRoutes);
mainRouter.use('/budget-profiles', budgetProfileRoutes);
mainRouter.use('/budgets', budgetRoutes);
mainRouter.use('/user-settings', userSettingsRoutes); // זה מטפל בהגדרות האפליקציה של המשתמש
mainRouter.use('/users', userRoutes);               // <<< זה יטפל בפעולות על המשתמש עצמו (כמו פרופיל)
mainRouter.use('/recurring-income-definitions', recurringIncomeRoutes); // <<< הוסף

export default mainRouter;