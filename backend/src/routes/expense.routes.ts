// backend/src/routes/expense.routes.ts
import { Router, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { AppDataSource } from '../data-source';
import { Expense, ExpenseType } from '../entity/Expense';
import { User } from '../entity/User';
import { Subcategory } from '../entity/Subcategory';
import { RecurringExpenseDefinition, Frequency } from '../entity/RecurringExpenseDefinition';
import { InstallmentTransaction } from '../entity/InstallmentTransaction';
import authMiddleware, { AuthenticatedRequest } from '../middleware/auth.middleware';
import { addMonths, format, parseISO, isValid as isValidDate } from 'date-fns';
import { buildExpenseResponse  } from '../utils/responseBuilders';
import { IsNull } from 'typeorm';

const router = Router();

// --- Validation Rules ---
// Base rules applicable to all or most types. Specifics handled in custom validator or downstream.
const baseExpenseValidationRules = [
  body('amount')
    .optional() // Make it optional here; will be required by specific types if needed
    .isNumeric().withMessage('Amount, if provided, must be a number.')
    .custom(value => { // Allow 0 or positive if provided, specific checks later
        const numValue = parseFloat(value);
        if (isNaN(numValue) || numValue < 0) {
            throw new Error('Amount, if provided, must be a non-negative number.');
        }
        return true;
    }),
  body('date') // For 'single' this is expense date, for 'recurring'/'installment' it's startDate/firstPaymentDate
    .notEmpty().withMessage('Date/Start Date is required.')
    .isISO8601().withMessage('Invalid date format, please use YYYY-MM-DD.')
    .customSanitizer(value => value ? format(parseISO(value), 'yyyy-MM-dd') : null),
  body('subcategoryId').notEmpty().withMessage('Subcategory ID is required.')
    .isInt({ gt: 0 }).withMessage('Subcategory ID must be a positive integer.'),
  body('description').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters.'),
  body('paymentMethod').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 50 }).withMessage('Payment method cannot exceed 50 characters.'),
  body('expenseType').notEmpty().withMessage('Expense type is required.')
    .isIn(['single', 'recurring', 'installment']).withMessage('Invalid expense type. Must be single, recurring, or installment.'),
];

// Custom validator to handle type-specific field requirements
const typeSpecificValidation = body().custom((value, { req }) => {
    const type = req.body.expenseType;
    const amount = req.body.amount;

    // Amount validation for single and recurring
    if (type === 'single' || type === 'recurring') {
        if (amount === undefined || amount === null || amount === '' || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
            throw new Error('Amount is required and must be a positive number for single/recurring expenses.');
        }
    }

    // Recurring specific validations
    if (type === 'recurring') {
        if (!req.body.frequency || !['daily', 'weekly', 'monthly', 'bi-monthly', 'quarterly', 'semi-annually', 'annually'].includes(req.body.frequency)) {
            throw new Error('Frequency is required for recurring expenses and must be valid.');
        }
        if (req.body.interval && (!Number.isInteger(parseInt(req.body.interval, 10)) || parseInt(req.body.interval, 10) < 1)) {
            throw new Error('Interval must be a positive integer if provided for recurring expenses.');
        }
        if (req.body.endDate && !isValidDate(parseISO(req.body.endDate))) { // checkFalsy for endDate to allow empty string turning to null
             throw new Error('End date is not a valid date if provided.');
        }
        if (req.body.occurrences && (!Number.isInteger(parseInt(req.body.occurrences, 10)) || parseInt(req.body.occurrences, 10) < 1) ) {
            throw new Error('Occurrences must be a positive integer if provided.');
        }
        if (req.body.endDate && req.body.occurrences) {
            throw new Error('Provide either endDate or occurrences for recurring expense, not both.');
        }
    }
    // Installment specific validations
    else if (type === 'installment') {
        if (req.body.totalAmount === undefined || req.body.totalAmount === null || req.body.totalAmount === '' || isNaN(parseFloat(req.body.totalAmount)) || parseFloat(req.body.totalAmount) <= 0) {
            throw new Error('Total amount is required and must be a positive number for installment expenses.');
        }
        if (req.body.numberOfInstallments === undefined || req.body.numberOfInstallments === null || req.body.numberOfInstallments === '' || !Number.isInteger(parseInt(req.body.numberOfInstallments,10)) || parseInt(req.body.numberOfInstallments,10) < 2) {
            throw new Error('Number of installments is required and must be at least 2 for installment expenses.');
        }
    }
    return true; // Indicates validation passed
});


// --- Create a new Expense (Unified Endpoint) ---
// POST /api/expenses
router.post(
  '/',
  authMiddleware,
  [...baseExpenseValidationRules, typeSpecificValidation], // Combine base and type-specific validations
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user!.id;
    const {
      amount, date: expenseDateOrStartDate, subcategoryId, description, paymentMethod, expenseType,
      frequency, interval = 1, endDate, occurrences, // Recurring
      totalAmount, numberOfInstallments             // Installment
    } = req.body;

    try {
      const userRepository = AppDataSource.getRepository(User);
      const subcategoryRepository = AppDataSource.getRepository(Subcategory);
      const expenseRepository = AppDataSource.getRepository(Expense);

      const user = await userRepository.findOneBy({ id: userId });
      if (!user) return res.status(404).json({ message: 'User not found' });

      const subcategory = await subcategoryRepository.findOne({
        where: { id: parseInt(subcategoryId, 10), archived: false },
        relations: ['category']
      });
      if (!subcategory) return res.status(400).json({ message: 'Subcategory not found or is archived.' });
      if (subcategory.category && subcategory.category.archived) {
        return res.status(400).json({ message: 'Cannot assign to an archived parent category.' });
      }

      if (expenseType === 'single') {
        const newExpense = expenseRepository.create({
          amount: parseFloat(amount), date: expenseDateOrStartDate, description, paymentMethod, user, subcategory,
          expenseType: 'single', isProcessed: true
        });
        await expenseRepository.save(newExpense);
        const response = await expenseRepository.findOne({ where: { id: newExpense.id }, relations: ["subcategory", "subcategory.category"]});
        return res.status(201).json(buildExpenseResponse(response!));
      }
      else if (expenseType === 'recurring') {
        const recurringRepo = AppDataSource.getRepository(RecurringExpenseDefinition);
        const definition = recurringRepo.create({
          userId, user, subcategoryId, subcategory, amount: parseFloat(amount), description, paymentMethod,
          frequency: frequency as Frequency,
          interval: parseInt(interval as string, 10) || 1, // Ensure interval is parsed
          startDate: expenseDateOrStartDate,
          endDate: endDate ? format(parseISO(endDate), 'yyyy-MM-dd') : null,
          occurrences: occurrences ? parseInt(occurrences, 10) : null,
          isActive: true,
          nextDueDate: expenseDateOrStartDate
        });
        await recurringRepo.save(definition);

        const instances: Partial<Expense>[] = [];
        let currentDueDate = parseISO(definition.startDate);
        const finalEndDate = definition.endDate ? parseISO(definition.endDate) : null;
        let occurrencesCount = 0;
        const MAX_INSTANCES = 365 * 2;

        while (instances.length < MAX_INSTANCES) {
          if (finalEndDate && currentDueDate > finalEndDate) break;
          if (definition.occurrences && occurrencesCount >= definition.occurrences) break;

          instances.push({
            amount: definition.amount, date: format(currentDueDate, 'yyyy-MM-dd'),
            description: definition.description, paymentMethod: definition.paymentMethod,
            user: user, userId: user.id, subcategory: subcategory, subcategoryId: subcategory.id,
            expenseType: 'recurring_instance', parentId: definition.id, isProcessed: false,
          });
          occurrencesCount++;

          switch (definition.frequency) {
            case 'daily': currentDueDate.setDate(currentDueDate.getDate() + definition.interval); break;
            case 'weekly': currentDueDate.setDate(currentDueDate.getDate() + (7 * definition.interval)); break;
            case 'monthly': currentDueDate = addMonths(currentDueDate, definition.interval); break;
            case 'bi-monthly': currentDueDate = addMonths(currentDueDate, 2 * definition.interval); break;
            case 'quarterly': currentDueDate = addMonths(currentDueDate, 3 * definition.interval); break;
            case 'semi-annually': currentDueDate = addMonths(currentDueDate, 6 * definition.interval); break;
            case 'annually': currentDueDate = addMonths(currentDueDate, 12 * definition.interval); break;
            default: throw new Error('Invalid frequency in recurring logic');
          }
        }

        if (instances.length > 0) {
          const expenseEntities = expenseRepository.create(instances);
          await expenseRepository.save(expenseEntities);
        }
        return res.status(201).json({ message: `Recurring expense definition created with ${instances.length} instances.`, definition });
      }
      else if (expenseType === 'installment') {
        const installmentRepo = AppDataSource.getRepository(InstallmentTransaction);
        const numInstallments = parseInt(numberOfInstallments, 10);
        const total = parseFloat(totalAmount);
        const calculatedInstallmentAmount = parseFloat((total / numInstallments).toFixed(2));
        const lastPaymentAmount = parseFloat((total - (calculatedInstallmentAmount * (numInstallments - 1))).toFixed(2));

        const transaction = installmentRepo.create({
          userId, user, subcategoryId, subcategory, totalAmount: total, numberOfInstallments: numInstallments,
          installmentAmount: calculatedInstallmentAmount,
          description, paymentMethod, firstPaymentDate: expenseDateOrStartDate, isCompleted: false,
        });
        await installmentRepo.save(transaction);

        const payments: Partial<Expense>[] = [];
        let currentPaymentDate = parseISO(transaction.firstPaymentDate);

        for (let i = 0; i < numInstallments; i++) {
          payments.push({
            amount: (i === numInstallments - 1) ? lastPaymentAmount : calculatedInstallmentAmount,
            date: format(currentPaymentDate, 'yyyy-MM-dd'),
            description: `${description || 'Installment'} (${i + 1}/${numInstallments})`, paymentMethod,
            user: user, userId: user.id, subcategory: subcategory, subcategoryId: subcategory.id,
            expenseType: 'installment_instance', parentId: transaction.id, isProcessed: false,
          });
          if (i < numInstallments - 1) {
            currentPaymentDate = addMonths(currentPaymentDate, 1);
          }
        }
        if (payments.length > 0) {
          const expenseEntities = expenseRepository.create(payments);
          await expenseRepository.save(expenseEntities);
        }
        return res.status(201).json({ message: `Installment transaction created with ${payments.length} payment instances.`, transaction });
      }
      else {
        return res.status(400).json({ message: 'Invalid expense type provided.' });
      }
    } catch (error: any) {
      console.error(`Error creating expense (type: ${expenseType || 'unknown'}):`, error);
      res.status(500).json({ message: `Server error: ${error.message || 'Failed to create expense'}` });
    }
  }
);

// --- Get all Expenses for the authenticated user ---
// GET /api/expenses
router.get(
  '/',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    try {
      const expenseRepository = AppDataSource.getRepository(Expense);
      const expenses = await expenseRepository.find({
        where: { user: { id: userId } },
        relations: { subcategory: { category: true } },
        select: {
            id: true, amount: true, date: true, description: true, paymentMethod: true,
            createdAt: true, updatedAt: true, deletedAt: true,
            expenseType: true, parentId: true, isProcessed: true,
            subcategory: { id: true, name: true, category: { id: true, name: true, type: true } }
        },
        order: { date: 'ASC', createdAt: 'ASC' },
        withDeleted: false,
      });
      res.json(expenses.map(exp => buildExpenseResponse(exp))); // Use helper for consistency
    } catch (error: any) {
      console.error('Error fetching expenses:', error);
      res.status(500).json({ message: `Server error: ${error.message || 'Failed to fetch expenses'}` });
    }
  }
);

// --- Get a specific Expense by ID ---
// GET /api/expenses/:id
router.get(
  '/:id',
  authMiddleware,
  [param('id').isInt({ gt: 0 }).withMessage('Expense ID must be a positive integer')],
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const userId = req.user!.id;
    const expenseId = parseInt(req.params.id, 10);

    try {
      const expenseRepository = AppDataSource.getRepository(Expense);
      const expense = await expenseRepository.findOne({
        where: { id: expenseId, userId: userId },
        relations: { subcategory: { category: true } },
        withDeleted: true,
      });

      if (!expense) {
        return res.status(404).json({ message: 'Expense not found or access denied' });
      }
      res.json(buildExpenseResponse(expense));
    } catch (error: any) {
      console.error('Error fetching expense:', error);
      res.status(500).json({ message: `Server error: ${error.message || 'Failed to fetch expense'}` });
    }
  }
);

// --- Update an existing Expense (Simplified for POC) ---
// PUT /api/expenses/:id
const updateExpenseValidationRules = [
    param('id').isInt({ gt: 0 }).withMessage('Expense ID must be a positive integer.'),
    body('amount').optional().isNumeric().withMessage('Amount must be a number.').bail().custom(value => parseFloat(value) > 0).withMessage('Amount must be positive.'),
    body('date').optional().isISO8601().withMessage('Invalid date format (YYYY-MM-DD).').customSanitizer(value => value ? format(parseISO(value), 'yyyy-MM-dd') : undefined),
    body('subcategoryId').optional().isInt({ gt: 0 }).withMessage('Subcategory ID must be a positive integer.'),
    body('description').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 500 }),
    body('paymentMethod').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 50 }),
    body('isProcessed').optional().isBoolean().withMessage('isProcessed must be a boolean.'),
    // Do not allow changing expenseType or parentId here
  ];
router.put(
  '/:id',
  authMiddleware,
  updateExpenseValidationRules,
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const userId = req.user!.id;
    const expenseId = parseInt(req.params.id, 10);
    const updates = req.body;

    try {
      const expenseRepository = AppDataSource.getRepository(Expense);
      const subcategoryRepository = AppDataSource.getRepository(Subcategory);

      let expense = await expenseRepository.findOneBy({ id: expenseId, userId: userId });
      if (!expense) return res.status(404).json({ message: 'Expense not found or access denied' });

      // Apply updates only to allowed fields
      if (updates.amount !== undefined) expense.amount = parseFloat(updates.amount);
      if (updates.date !== undefined) expense.date = updates.date;
      if (updates.description !== undefined) expense.description = updates.description;
      if (updates.paymentMethod !== undefined) expense.paymentMethod = updates.paymentMethod;
      if (updates.isProcessed !== undefined) expense.isProcessed = updates.isProcessed;

      if (updates.subcategoryId !== undefined && updates.subcategoryId !== expense.subcategoryId) {
        const newSubcategory = await subcategoryRepository.findOne({
          where: { id: parseInt(updates.subcategoryId, 10), archived: false },
          relations: ['category']
        });
        if (!newSubcategory) return res.status(400).json({ message: 'New Subcategory not found or is archived.' });
        if (newSubcategory.category && newSubcategory.category.archived) {
          return res.status(400).json({ message: 'Cannot assign to an archived parent category.' });
        }
        expense.subcategory = newSubcategory; // Assign the entity
        expense.subcategoryId = newSubcategory.id; // Also explicitly set the ID
      }

      await expenseRepository.save(expense);
      const updatedExpenseWithRelations = await expenseRepository.findOne({ where: { id: expense.id }, relations: ["subcategory", "subcategory.category"]});
      res.json(buildExpenseResponse(updatedExpenseWithRelations!));

    } catch (error: any) {
      console.error('Error updating expense:', error);
      res.status(500).json({ message: `Server error: ${error.message || 'Failed to update expense'}` });
    }
  }
);

// --- Soft Delete an Expense ---
// DELETE /api/expenses/:id
router.delete(
  '/:id',
  authMiddleware,
  [param('id').isInt({ gt: 0 }).withMessage('Expense ID must be a positive integer')],
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const userId = req.user!.id;
    const expenseId = parseInt(req.params.id, 10);

    try {
      const expenseRepository = AppDataSource.getRepository(Expense);
      // Important: softDelete requires a criteria object matching the entity structure or just the ID.
      // To ensure user owns the expense, it's better to fetch then softRemove, or ensure criteria includes userId.
      const result = await expenseRepository.softDelete({ id: expenseId, userId: userId });

      if (result.affected === 0) {
        return res.status(404).json({ message: 'Expense not found or access denied' });
      }
      res.status(200).json({ message: 'Expense soft deleted successfully' });
    } catch (error: any) {
      console.error('Error soft deleting expense:', error);
      res.status(500).json({ message: `Server error: ${error.message || 'Failed to soft delete expense'}` });
    }
  }
);

// --- Restore a soft-deleted Expense ---
// PATCH /api/expenses/:id/restore
router.patch(
  '/:id/restore',
  authMiddleware,
  [param('id').isInt({ gt: 0 }).withMessage('Expense ID must be a positive integer')],
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const userId = req.user!.id;
    const expenseId = parseInt(req.params.id, 10);

    try {
      const expenseRepository = AppDataSource.getRepository(Expense);
      const expenseToRestore = await expenseRepository.findOne({
        where: { id: expenseId, userId: userId }, // Ensure ownership
        withDeleted: true,
      });

      if (!expenseToRestore) return res.status(404).json({ message: 'Expense not found or access denied.' });
      if (!expenseToRestore.deletedAt) return res.status(400).json({ message: 'Expense is not deleted.' });

      await expenseRepository.restore({ id: expenseId, userId: userId }); // Use criteria object
      res.status(200).json({ message: 'Expense restored successfully' });
    } catch (error: any) {
      console.error('Error restoring expense:', error);
      res.status(500).json({ message: `Server error: ${error.message || 'Failed to restore expense'}` });
    }
  },
  
// --- Mark an expense as processed ---
// PATCH /api/expenses/:id/process
router.patch(
  '/:id/process',
  authMiddleware,
  [
    param('id').isInt({ gt: 0 }).withMessage('Expense ID must be a positive integer.')
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const expenseId = parseInt(req.params.id, 10);
    const userId = req.user!.id;

    try {
      const expenseRepository = AppDataSource.getRepository(Expense);
      const expense = await expenseRepository.findOne({
        where: { id: expenseId, userId: userId, deletedAt: IsNull() } // ודא שההוצאה לא מחוקה
      });

      if (!expense) {
        return res.status(404).json({ message: 'Expense not found or you are not authorized to modify it' });
      }

      if (expense.expenseType === 'single') { // הוצאות "single" כבר מסומנות isProcessed: true ביצירה
        return res.status(400).json({ message: 'Single expenses are already processed.'});
      }

      if (expense.isProcessed) {
        return res.status(400).json({ message: 'Expense is already marked as processed' });
      }

      expense.isProcessed = true;
      // אופציונלי: אם רוצים לעדכן את התאריך לתאריך הנוכחי בעת הסימון עבור הוצאות מתוכננות
      // אם תאריך ההוצאה המקורי היה בעתיד, אולי עדיף לא לשנות אותו, אלא רק את isProcessed.
      // if (parseISO(expense.date) > new Date()) {
      //   expense.date = format(new Date(), 'yyyy-MM-dd');
      // }
      
      await expenseRepository.save(expense);
      
      // החזר את ההוצאה המעודכנת
      const updatedExpenseWithRelations = await expenseRepository.findOne({ 
          where: { id: expense.id }, 
          relations: ["subcategory", "subcategory.category"] // טען יחסים לתגובה מלאה
      });
      res.json(buildExpenseResponse(updatedExpenseWithRelations!));

    } catch (error: any) {
      console.error(`Error marking expense ${expenseId} as processed:`, error);
      res.status(500).json({ message: 'Server error while processing expense' });
    }
  }
)
);

export default router;