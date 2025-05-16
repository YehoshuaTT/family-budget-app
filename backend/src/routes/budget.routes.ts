// backend/src/routes/budget.routes.ts
import { Router, Response } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { AppDataSource } from '../data-source';
import { Budget } from '../entity/Budget';
import { User } from '../entity/User'; // Not strictly needed for operations if using userId
import { Subcategory } from '../entity/Subcategory';
import { BudgetProfile } from '../entity/BudgetProfile'; // To validate budgetProfileId
import authMiddleware, { AuthenticatedRequest } from '../middleware/auth.middleware';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { FindManyOptions, FindOptionsWhere, In } from 'typeorm'; // Import In
import { Expense } from '../entity/Expense';


const router = Router();

const currentYear = new Date().getFullYear();

// Validation rules for creating/updating a budget entry
const budgetEntryValidation = [
  body('budgetProfileId').notEmpty().withMessage('Budget Profile ID is required.').isInt({ gt: 0 }).withMessage('Budget Profile ID must be a positive integer.'),
  body('subcategoryId').notEmpty().withMessage('Subcategory ID is required.').isInt({ gt: 0 }).withMessage('Subcategory ID must be a positive integer.'),
  body('year').notEmpty().withMessage('Year is required.').isInt({ min: currentYear - 5, max: currentYear + 5 }).withMessage(`Year must be between ${currentYear - 5} and ${currentYear + 5}.`),
  body('month').notEmpty().withMessage('Month is required.').isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12.'),
  body('allocatedAmount').notEmpty().withMessage('Allocated amount is required.').isNumeric().custom(value => parseFloat(value) >= 0).withMessage('Allocated amount must be a non-negative number.'),
];

// Upsert (Create or Update) a budget entry for a specific subcategory, month, and year, linked to a budget profile
// POST /api/budgets
router.post(
  '/',
  authMiddleware,
  budgetEntryValidation,
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user!.id;
    const { budgetProfileId, subcategoryId, year, month, allocatedAmount } = req.body;

    try {
      const budgetRepository = AppDataSource.getRepository(Budget);
      const subcategoryRepository = AppDataSource.getRepository(Subcategory);
      const budgetProfileRepository = AppDataSource.getRepository(BudgetProfile);

      // Validate budgetProfileId belongs to the user
      const budgetProfile = await budgetProfileRepository.findOneBy({ id: parseInt(budgetProfileId, 10), userId: userId });
      if (!budgetProfile) {
        return res.status(400).json({ message: 'Budget Profile not found or access denied.' });
      }
      // Optional: only allow adding to an active profile
      // if (!budgetProfile.isActive) {
      //   return res.status(400).json({ message: 'Cannot add budget to an inactive profile.' });
      // }

      // Validate subcategory existence and ensure it's not archived and belongs to an expense category
      const subcategory = await subcategoryRepository.findOne({
        where: { id: parseInt(subcategoryId, 10), archived: false, category: { type: 'expense', archived: false } },
        relations: ['category']
      });
      if (!subcategory) {
        return res.status(400).json({ message: 'Subcategory not found, is archived, or not an expense subcategory.' });
      }

      // Find existing budget entry or create a new one
      let budgetEntry = await budgetRepository.findOneBy({
        budgetProfileId: parseInt(budgetProfileId, 10),
        subcategoryId: parseInt(subcategoryId, 10),
        year: parseInt(year, 10),
        month: parseInt(month, 10),
        userId: userId, // Ensure uniqueness is also per user if a profile could be shared (though our model implies userId on profile)
      });

      if (budgetEntry) {
        // Update existing entry
        budgetEntry.allocatedAmount = parseFloat(allocatedAmount);
      } else {
        // Create new entry
        budgetEntry = budgetRepository.create({
          userId, // User who owns this specific budget line (redundant if profile is strictly user-owned but good for direct queries)
          subcategoryId: parseInt(subcategoryId, 10),
          year: parseInt(year, 10),
          month: parseInt(month, 10),
          allocatedAmount: parseFloat(allocatedAmount),
          budgetProfileId: parseInt(budgetProfileId, 10),
          // For TypeORM to correctly associate objects if relations are defined on Budget entity:
          // user: { id: userId } as User, 
          // subcategory: { id: parseInt(subcategoryId, 10) } as Subcategory,
          // budgetProfile: { id: parseInt(budgetProfileId, 10) } as BudgetProfile,
        });
      }

      const savedBudget = await budgetRepository.save(budgetEntry);
      // Fetch with relations for response consistency
      const responseEntry = await budgetRepository.findOne({
          where: {id: savedBudget.id },
          relations: ["subcategory", "subcategory.category", "budgetProfile"]
      });
      res.status(budgetEntry.createdAt.getTime() === savedBudget.updatedAt.getTime() ? 201 : 200).json(responseEntry);

    } catch (error: any) {
      if (error.code === '23505') { // Unique constraint violation
        return res.status(409).json({ message: 'Budget entry for this profile, subcategory, month, and year already exists.' });
      }
      console.error('Error upserting budget entry:', error);
      res.status(500).json({ message: `Server error: ${error.message || 'Failed to save budget entry'}` });
    }
  }
);

// GET /api/budgets - Get all budget entries for a user
router.get(
  '/',
  authMiddleware,
  [
    query('year').optional().isInt({ min: currentYear - 5, max: currentYear + 5 }).withMessage('Year must be valid.'),
    query('month').optional().isInt({ min: 1, max: 12 }).withMessage('Month must be valid.'),
    query('budgetProfileId').optional().isInt({ gt: 0 }).withMessage('Budget Profile ID must be a positive integer if provided.'),
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user!.id;
    const { year, month, budgetProfileId } = req.query;

    try {
      const budgetRepository = AppDataSource.getRepository(Budget);
      
      const whereConditions: FindOptionsWhere<Budget> = { userId };
      if (budgetProfileId) whereConditions.budgetProfileId = parseInt(budgetProfileId as string, 10);
      if (year) whereConditions.year = parseInt(year as string, 10);
      if (month) whereConditions.month = parseInt(month as string, 10);
      
      const findOptions: FindManyOptions<Budget> = { 
        where: whereConditions,
        relations: ["subcategory", "subcategory.category", "budgetProfile"],
        order: { year: "DESC", month: "DESC", subcategory: { name: "ASC" } }
      };
      
      const budgetEntries = await budgetRepository.find(findOptions);

      // If a specific year and month are provided, calculate spent amounts
      if (year && month && budgetEntries.length > 0) {
          const expenseRepository = AppDataSource.getRepository(Expense);
          const subcategoryIds = budgetEntries.map(b => b.subcategoryId);

          if (subcategoryIds.length > 0) { // Ensure there are subcategories to query for
              const yearNum = parseInt(year as string, 10);
              const monthNum = parseInt(month as string, 10);
              const startDate = format(new Date(yearNum, monthNum - 1, 1), 'yyyy-MM-dd');
              const endDate = format(endOfMonth(new Date(yearNum, monthNum - 1, 1)), 'yyyy-MM-dd');

              const spentAmounts = await expenseRepository.createQueryBuilder("expense")
                  .select("expense.subcategoryId", "subcategoryId")
                  .addSelect("SUM(expense.amount)", "totalSpent")
                  .where("expense.userId = :userId", { userId })
                  .andWhere("expense.subcategoryId IN (:...subcategoryIds)", { subcategoryIds })
                  .andWhere("expense.date >= :startDate AND expense.date <= :endDate", { startDate, endDate })
                  .andWhere("expense.isProcessed = true")
                  .andWhere("expense.deletedAt IS NULL")
                  .groupBy("expense.subcategoryId")
                  .getRawMany();
              
              const spentMap = new Map(spentAmounts.map(item => [item.subcategoryId, parseFloat(item.totalSpent)]));

              const budgetWithSpending = budgetEntries.map(budget => ({
                  ...budget,
                  spentAmount: spentMap.get(budget.subcategoryId) || 0,
                  remainingAmount: parseFloat(budget.allocatedAmount as any) - (spentMap.get(budget.subcategoryId) || 0)
              }));
              return res.json(budgetWithSpending);
          }
      }
      // If not specific year/month, or no subcategories, return budgets without spending info
      res.json(budgetEntries.map(b => ({...b, spentAmount: null, remainingAmount: null })));

    } catch (error: any) {
      console.error('Error fetching budget entries:', error);
      res.status(500).json({ message: `Server error: ${error.message || 'Failed to fetch budget entries'}` });
    }
  }
);


// DELETE /api/budgets/:id - Delete a specific budget entry (allocation)
router.delete(
  '/:id',
  authMiddleware,
  [param('id').isInt({ gt: 0 }).withMessage('Budget ID must be a positive integer.')],
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user!.id; // User ID from token
    const budgetId = parseInt(req.params.id, 10);

    try {
      const budgetRepository = AppDataSource.getRepository(Budget);
      // Ensure the budget entry belongs to the user before deleting
      const result = await budgetRepository.softDelete({ id: budgetId, userId: userId }); 
      // We added DeleteDateColumn to Budget entity, so softDelete should work

      if (result.affected === 0) {
        return res.status(404).json({ message: 'Budget entry not found or access denied.' });
      }
      res.status(200).json({ message: 'Budget entry soft deleted successfully.' });
    } catch (error: any) {
      console.error('Error soft deleting budget entry:', error);
      res.status(500).json({ message: `Server error: ${error.message || 'Failed to soft delete budget entry'}` });
    }
  }
);

// Optional: Add an endpoint to get a single budget entry by ID if needed
// GET /api/budgets/:id
router.get('/:id', authMiddleware, [param('id').isInt({gt:0})], async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const userId = req.user!.id;
    const budgetId = parseInt(req.params.id, 10);

    try {
        const budgetRepository = AppDataSource.getRepository(Budget);
        const budgetEntry = await budgetRepository.findOne({
            where: {id: budgetId, userId},
            relations: ["subcategory", "subcategory.category", "budgetProfile"]
        });
        if (!budgetEntry) return res.status(404).json({message: "Budget entry not found or access denied."});
        
        // Calculate spent amount for this specific budget entry's period
        let spentAmountData = { spentAmount: 0, remainingAmount: parseFloat(budgetEntry.allocatedAmount as any) };
        if (budgetEntry.year && budgetEntry.month) {
            const expenseRepository = AppDataSource.getRepository(Expense);
            const startDate = format(new Date(budgetEntry.year, budgetEntry.month - 1, 1), 'yyyy-MM-dd');
            const endDate = format(endOfMonth(new Date(budgetEntry.year, budgetEntry.month - 1, 1)), 'yyyy-MM-dd');

            const result = await expenseRepository.createQueryBuilder("expense")
                .select("SUM(expense.amount)", "totalSpent")
                .where("expense.userId = :userId", { userId })
                .andWhere("expense.subcategoryId = :subcategoryId", { subcategoryId: budgetEntry.subcategoryId })
                .andWhere("expense.date >= :startDate AND expense.date <= :endDate", { startDate, endDate })
                .andWhere("expense.isProcessed = true")
                .andWhere("expense.deletedAt IS NULL")
                .getRawOne();
            
            const totalSpent = parseFloat(result?.totalSpent) || 0;
            spentAmountData.spentAmount = totalSpent;
            spentAmountData.remainingAmount = parseFloat(budgetEntry.allocatedAmount as any) - totalSpent;
        }
        
        res.json({...budgetEntry, ...spentAmountData});

    } catch (error: any) {
        console.error('Error fetching single budget entry:', error);
        res.status(500).json({ message: `Server error: ${error.message || 'Failed to fetch budget entry'}` });
    }
});


export default router;