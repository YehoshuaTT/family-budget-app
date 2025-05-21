// backend/src/routes/income.routes.ts
import { Router, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { AppDataSource } from '../data-source';
import { Income } from '../entity/Income';
import { User } from '../entity/User'; // Needed if you associate User object directly
import { Category } from '../entity/Category'; // For associating income category
import authMiddleware, { AuthenticatedRequest } from '../middleware/auth.middleware';
import { format, parseISO } from 'date-fns';
import { buildIncomeResponse } from '../utils/responseBuilders';
import { In, IsNull } from 'typeorm';
import { updateRecurringDefinitionAfterChildChange, deleteAllRecurringInstancesAndParent } from '../services/recurringIncome.service';

const router = Router();

// --- Validation Rules for Create/Update Income ---

const incomeValidationRules = [
  body('amount')
    .notEmpty().withMessage('Amount is required.')
    .isNumeric().withMessage('Amount must be a number.')
    .bail() // עצור ולידציות נוספות לשדה זה אם הקודמות נכשלו
    .custom(value => parseFloat(value) > 0).withMessage('Amount must be positive.'),

  body('date')
    .notEmpty().withMessage('Date is required.')
    .isISO8601().withMessage('Invalid date format, please use YYYY-MM-DD.')
    .customSanitizer(value => value ? format(parseISO(value), 'yyyy-MM-dd') : null),

  body('categoryId') // ולידציה לקטגוריה
    .optional({ checkFalsy: true }) // מאפשר "" או null או undefined לעבור. ירוץ רק אם יש ערך "אמיתי"
    .isInt({ gt: 0 }).withMessage('Category ID must be a positive integer if provided.')
    .toInt(), // המר למספר אם זה אכן מחרוזת של מספר

  body('description') // ולידציה לתיאור
    .optional({ nullable: true, checkFalsy: true }) // מאפשר "" או null או undefined
    .isString().withMessage('Description must be a string.') // ודא שזה מחרוזת
    .trim() // הסר רווחים מיותרים
    .isLength({ max: 255 }).withMessage('Description cannot exceed 255 characters.')
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
    const { amount, date, categoryId, description, parentId, recurringDefinitionId } = req.body;

    try {
      const incomeRepository = AppDataSource.getRepository(Income);
      const userRepository = AppDataSource.getRepository(User);
      const categoryRepository = AppDataSource.getRepository(Category);
      const user = await userRepository.findOneBy({ id: userId });
      if (!user) return res.status(404).json({ message: 'User not found for token' });

      let categoryEntity: Category | null = null;
      if (categoryId) {
        categoryEntity = await categoryRepository.createQueryBuilder("cat")
            .where("cat.id = :id", { id: categoryId })
            .andWhere("cat.type = :type", { type: 'income' })
            .andWhere("cat.archived = :archived", { archived: false })
            .andWhere("(cat.userId = :userId OR cat.userId IS NULL)", { userId: userId })
            .getOne();
        if (!categoryEntity) {
          return res.status(400).json({ message: `Income category with ID ${categoryId} not found, is not of type 'income', is archived, or not accessible to this user.` });
        }
      }

      // Support recurring income instance creation: set parentId if provided (from recurringDefinitionId or parentId)
      let resolvedParentId = null;
      if (parentId) {
        resolvedParentId = parentId;
      } else if (recurringDefinitionId) {
        resolvedParentId = recurringDefinitionId;
      }

      const newIncome = incomeRepository.create({
        amount: parseFloat(amount),
        date: date,
        description: description || undefined,
        user: user,
        categoryId: categoryEntity ? categoryEntity.id : undefined,
        parentId: resolvedParentId || undefined,
        isProcessed: true // All POST /incomes are real, processed incomes
      });

      await incomeRepository.save(newIncome);

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
    const { amount, date, categoryId, description, affectAllRecurring } = req.body;

    try {
      const incomeRepository = AppDataSource.getRepository(Income);
      const categoryRepository = AppDataSource.getRepository(Category);
      const income = await incomeRepository.findOneBy({ id: incomeId, userId: userId });
      if (!income) return res.status(404).json({ message: 'Income not found or access denied' });

      // If this is a recurring instance and user wants to edit all, update all children and parent
      if (income.parentId && affectAllRecurring === true) {
        // Update all children
        const updateFields: any = {
          amount: parseFloat(amount),
          date: date, // This will overwrite all dates! (optionally skip or handle differently)
          description: description || null,
        };
        if (categoryId !== undefined) {
          updateFields.categoryId = categoryId;
        }
        await incomeRepository.update({ parentId: income.parentId, userId }, updateFields);
        // Update parent definition
        // (You may want to update only relevant fields)
        // ...
        // For now, just update amount/description/categoryId
        const defRepo = AppDataSource.getRepository(require('../entity/RecurringIncomeDefinition').RecurringIncomeDefinition);
        await defRepo.update({ id: income.parentId, userId }, {
          amount: parseFloat(amount),
          description: description || null,
          categoryId: categoryId !== undefined ? categoryId : undefined,
        });
        return res.status(200).json({ message: 'All recurring incomes and parent definition updated' });
      }

      // Otherwise, update only this instance
      income.amount = parseFloat(amount);
      income.date = date;
      income.description = description || null;
      if (categoryId !== undefined) {
        if (categoryId === null || categoryId === '') {
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
      // If this is a recurring child, update parent definition
      if (income.parentId) {
        await updateRecurringDefinitionAfterChildChange({
          parentId: income.parentId,
          userId,
          deletedChildDate: income.date,
          action: 'edit',
        });
      }
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
    const { affectAllRecurring } = req.query; // expects 'true' or 'false' from frontend

    try {
      const incomeRepository = AppDataSource.getRepository(Income);
      const income = await incomeRepository.findOne({ where: { id: incomeId, userId }, withDeleted: false });
      if (!income) return res.status(404).json({ message: 'Income not found or access denied' });

      // If this is a recurring instance and user wants to delete all, delete all children and parent
      if (income.parentId && affectAllRecurring === 'true') {
        await deleteAllRecurringInstancesAndParent({ parentId: income.parentId, userId });
        return res.status(200).json({ message: 'All recurring incomes and parent definition deleted' });
      }

      // Otherwise, delete only this instance
      await incomeRepository.softDelete({ id: incomeId, userId });
      // If this is a recurring child, update parent definition
      if (income.parentId) {
        await updateRecurringDefinitionAfterChildChange({
          parentId: income.parentId,
          userId,
          deletedChildDate: income.date,
          action: 'delete',
        });
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

// --- Mark an Income as Processed ---
// PATCH /api/incomes/:id/mark-processed
router.patch(
  '/:id/mark-processed',
  authMiddleware,
  [param('id').isInt({ gt: 0 }).withMessage('Income ID must be a positive integer')],
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const userId = req.user!.id;
    const incomeId = parseInt(req.params.id, 10);

    try {
      const incomeRepository = AppDataSource.getRepository(Income);
      const income = await incomeRepository.findOneBy({ id: incomeId, userId });
      if (!income) return res.status(404).json({ message: 'Income not found or access denied.' });
      if (income.isProcessed) return res.status(400).json({ message: 'Income is already marked as processed.' });
      income.isProcessed = true;
      await incomeRepository.save(income);
      res.status(200).json({ message: 'Income marked as processed successfully' });
    } catch (error: any) {
      console.error('Error marking income as processed:', error);
      res.status(500).json({ message: `Server error: ${error.message || 'Failed to mark income as processed'}` });
    }
  }
);

// --- Bulk soft delete all incomes by parentId (for recurring definition deletion) ---
// DELETE /api/incomes/by-parent/:parentId
router.delete(
  '/by-parent/:parentId',
  authMiddleware,
  [param('parentId').isInt({ gt: 0 }).withMessage('Parent ID must be a positive integer')],
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const userId = req.user!.id;
    const parentId = parseInt(req.params.parentId, 10);
    try {
      const incomeRepository = AppDataSource.getRepository(Income);
      // Only soft delete incomes for this user and parentId
      const result = await incomeRepository.softDelete({ parentId, userId });
      res.status(200).json({ message: `Soft deleted ${result.affected} incomes with parentId ${parentId}` });
    } catch (error: any) {
      console.error('Error bulk soft deleting incomes by parentId:', error);
      res.status(500).json({ message: `Server error: ${error.message || 'Failed to bulk soft delete incomes'}` });
    }
  }
);

export default router;