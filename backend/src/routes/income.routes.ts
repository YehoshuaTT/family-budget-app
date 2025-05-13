// backend/src/routes/income.routes.ts
import { Router, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { AppDataSource } from '../data-source';
import { Income } from '../entity/Income';
import { User } from '../entity/User'; // Needed if you associate User object directly
import { Category } from '../entity/Category'; // For associating income category
import authMiddleware, { AuthenticatedRequest } from '../middleware/auth.middleware';
import { format, parseISO } from 'date-fns';

const router = Router();

// --- Helper function to build standardized income response object ---
const buildIncomeResponse = (income: Income | null) => {
  if (!income) return null;
  return {
    id: income.id,
    amount: parseFloat(income.amount as any), // Ensure amount is number
    date: income.date,
    description: income.description,
    category: income.category ? { // Include category details if available
        id: income.category.id,
        name: income.category.name,
        type: income.category.type
    } : null,
    createdAt: income.createdAt,
    updatedAt: income.updatedAt,
    deletedAt: income.deletedAt
  };
};

// --- Validation Rules for Create/Update Income ---
const incomeValidationRules = [
  body('amount').notEmpty().withMessage('Amount is required.')
    .isNumeric().withMessage('Amount must be a number.')
    .bail().custom(value => parseFloat(value) > 0).withMessage('Amount must be positive.'),
  body('date').notEmpty().withMessage('Date is required.')
    .isISO8601().withMessage('Invalid date format, please use YYYY-MM-DD.')
    .customSanitizer(value => value ? format(parseISO(value), 'yyyy-MM-dd') : null), // Sanitize to 'yyyy-MM-dd' string
  body('categoryId').optional({ nullable: true }).isInt({ gt: 0 }).withMessage('Category ID must be a positive integer if provided.'),
  body('description').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 255 }).withMessage('Description cannot exceed 255 characters.'),
];

// --- Create a new Income ---
// POST /api/incomes
router.post(
  '/',
  authMiddleware,
  incomeValidationRules,
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user!.id;
    const { amount, date, categoryId, description } = req.body;

    try {
      const incomeRepository = AppDataSource.getRepository(Income);
      const userRepository = AppDataSource.getRepository(User); // To fetch the User entity
      const categoryRepository = AppDataSource.getRepository(Category);

      const user = await userRepository.findOneBy({ id: userId });
      if (!user) return res.status(404).json({ message: 'User not found for token' });

      let category: Category | null = null;
      if (categoryId) {
        category = await categoryRepository.findOne({
            where: { id: parseInt(categoryId, 10), type: 'income', archived: false }
        });
        if (!category) return res.status(400).json({ message: 'Income category not found, is not of type "income", or is archived.' });
      }

      const newIncome = incomeRepository.create({
        amount: parseFloat(amount),
        date: date, // Already formatted string
        description,
        user: user, // Associate with the User entity
        category: category || undefined, // Associate with Category entity, or undefined if no categoryId
        categoryId: category ? category.id : undefined,
      });

      await incomeRepository.save(newIncome);

      // Fetch again with relations for a consistent response
      const createdIncomeWithRelations = await incomeRepository.findOne({
          where: { id: newIncome.id },
          relations: ["category"]
      });

      res.status(201).json(buildIncomeResponse(createdIncomeWithRelations!));

    } catch (error: any) {
      console.error('Error creating income:', error);
      res.status(500).json({ message: `Server error: ${error.message || 'Failed to create income'}` });
    }
  }
);

// --- Get all Incomes for the authenticated user ---
// GET /api/incomes
router.get(
  '/',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    try {
      const incomeRepository = AppDataSource.getRepository(Income);
      const incomes = await incomeRepository.find({
        where: { user: { id: userId } },
        relations: ["category"], // Eager load the category
        order: { date: 'DESC', createdAt: 'DESC' },
        withDeleted: false, // Default: only active incomes
      });
      res.json(incomes.map(buildIncomeResponse));
    } catch (error: any) {
      console.error('Error fetching incomes:', error);
      res.status(500).json({ message: `Server error: ${error.message || 'Failed to fetch incomes'}` });
    }
  }
);

// --- Get a specific Income by ID ---
// GET /api/incomes/:id
router.get(
  '/:id',
  authMiddleware,
  [param('id').isInt({ gt: 0 }).withMessage('Income ID must be a positive integer')],
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const userId = req.user!.id;
    const incomeId = parseInt(req.params.id, 10);

    try {
      const incomeRepository = AppDataSource.getRepository(Income);
      const income = await incomeRepository.findOne({
        where: { id: incomeId, userId: userId }, // Ensure it belongs to the user
        relations: ["category"],
        withDeleted: true, // Allow fetching soft-deleted
      });

      if (!income) {
        return res.status(404).json({ message: 'Income not found or access denied' });
      }
      res.json(buildIncomeResponse(income));
    } catch (error: any) {
      console.error('Error fetching income:', error);
      res.status(500).json({ message: `Server error: ${error.message || 'Failed to fetch income'}` });
    }
  }
);

// --- Update an existing Income ---
// PUT /api/incomes/:id
router.put(
  '/:id',
  authMiddleware,
  [
    param('id').isInt({ gt: 0 }).withMessage('Income ID must be a positive integer'),
    ...incomeValidationRules // Reuse base validation rules
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const userId = req.user!.id;
    const incomeId = parseInt(req.params.id, 10);
    const { amount, date, categoryId, description } = req.body;

    try {
      const incomeRepository = AppDataSource.getRepository(Income);
      const categoryRepository = AppDataSource.getRepository(Category);

      let income = await incomeRepository.findOneBy({ id: incomeId, userId: userId });
      if (!income) return res.status(404).json({ message: 'Income not found or access denied' });

      // Apply updates
      income.amount = parseFloat(amount);
      income.date = date; // Already formatted
      income.description = description || null; // Set to null if empty string passed for optional

      if (categoryId !== undefined) { // Check if categoryId was part of the update request
        if (categoryId === null || categoryId === '') { // Allow unsetting the category
            income.category = null;
            income.categoryId = null;
        } else {
            const newCategory = await categoryRepository.findOne({
                where: { id: parseInt(categoryId, 10), type: 'income', archived: false }
            });
            if (!newCategory) return res.status(400).json({ message: 'New Income category not found, is not of type "income", or is archived.' });
            income.category = newCategory;
            income.categoryId = newCategory.id;
        }
      }


      await incomeRepository.save(income);
      const updatedIncomeWithRelations = await incomeRepository.findOne({ where: { id: income.id }, relations: ["category"]});
      res.json(buildIncomeResponse(updatedIncomeWithRelations!));

    } catch (error: any) {
      console.error('Error updating income:', error);
      res.status(500).json({ message: `Server error: ${error.message || 'Failed to update income'}` });
    }
  }
);

// --- Soft Delete an Income ---
// DELETE /api/incomes/:id
router.delete(
  '/:id',
  authMiddleware,
  [param('id').isInt({ gt: 0 }).withMessage('Income ID must be a positive integer')],
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const userId = req.user!.id;
    const incomeId = parseInt(req.params.id, 10);

    try {
      const incomeRepository = AppDataSource.getRepository(Income);
      const result = await incomeRepository.softDelete({ id: incomeId, userId: userId });

      if (result.affected === 0) {
        return res.status(404).json({ message: 'Income not found or access denied' });
      }
      res.status(200).json({ message: 'Income soft deleted successfully' });
    } catch (error: any) {
      console.error('Error soft deleting income:', error);
      res.status(500).json({ message: `Server error: ${error.message || 'Failed to soft delete income'}` });
    }
  }
);

// --- Restore a soft-deleted Income ---
// PATCH /api/incomes/:id/restore
router.patch(
  '/:id/restore',
  authMiddleware,
  [param('id').isInt({ gt: 0 }).withMessage('Income ID must be a positive integer')],
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const userId = req.user!.id;
    const incomeId = parseInt(req.params.id, 10);

    try {
      const incomeRepository = AppDataSource.getRepository(Income);
      const incomeToRestore = await incomeRepository.findOne({
        where: { id: incomeId, userId: userId },
        withDeleted: true,
      });

      if (!incomeToRestore) return res.status(404).json({ message: 'Income not found or access denied.' });
      if (!incomeToRestore.deletedAt) return res.status(400).json({ message: 'Income is not deleted.' });

      await incomeRepository.restore({ id: incomeId, userId: userId });
      res.status(200).json({ message: 'Income restored successfully' });
    } catch (error: any) {
      console.error('Error restoring income:', error);
      res.status(500).json({ message: `Server error: ${error.message || 'Failed to restore income'}` });
    }
  }
);

export default router;