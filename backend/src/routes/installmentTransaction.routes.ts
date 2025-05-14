// backend/src/routes/installmentTransaction.routes.ts
import { Router, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { AppDataSource } from '../data-source';
import { InstallmentTransaction } from '../entity/InstallmentTransaction';
import { Expense } from '../entity/Expense';
import { User } from '../entity/User';
import { Subcategory } from '../entity/Subcategory';
import authMiddleware, { AuthenticatedRequest } from '../middleware/auth.middleware';
import { format, parseISO, addMonths } from 'date-fns';

const router = Router();

// --- Validation Rules for Create Installment Transaction ---
// (This is mostly handled by the unified POST /api/expenses, but useful if we add a direct POST here)
const installmentValidationRules = [
  body('totalAmount').notEmpty().isNumeric().custom(v => parseFloat(v) > 0).withMessage('Total amount must be a positive number.'),
  body('numberOfInstallments').notEmpty().isInt({ gt: 1 }).withMessage('Number of installments must be at least 2.'),
  body('subcategoryId').notEmpty().isInt({ gt: 0 }).withMessage('Subcategory ID must be a positive integer.'),
  body('description').optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
  body('paymentMethod').optional({ nullable: true }).isString().trim().isLength({ max: 50 }),
  body('firstPaymentDate').notEmpty().isISO8601().withMessage('First payment date must be valid (YYYY-MM-DD).')
    .customSanitizer(value => value ? format(parseISO(value), 'yyyy-MM-dd') : null),
];

// Helper to generate expense instances for an installment transaction
const generateInstallmentPayments = async (transaction: InstallmentTransaction, user: User, subcategory: Subcategory): Promise<Partial<Expense>[]> => {
    const payments: Partial<Expense>[] = [];
    if (transaction.isCompleted) return payments;

    let currentPaymentDate = parseISO(transaction.firstPaymentDate);
    const numInstallments = transaction.numberOfInstallments;
    const baseInstallmentAmount = transaction.installmentAmount; // Already calculated and stored
    // Recalculate last payment amount to ensure total matches exactly
    const totalFromBase = parseFloat((baseInstallmentAmount * (numInstallments - 1)).toFixed(2));
    const lastPaymentAmount = parseFloat((transaction.totalAmount - totalFromBase).toFixed(2));


    for (let i = 0; i < numInstallments; i++) {
        payments.push({
            amount: (i === numInstallments - 1) ? lastPaymentAmount : baseInstallmentAmount,
            date: format(currentPaymentDate, 'yyyy-MM-dd'),
            description: `${transaction.description || 'Installment'} (${i + 1}/${numInstallments})`,
            paymentMethod: transaction.paymentMethod,
            user: user,
            userId: user.id,
            subcategory: subcategory,
            subcategoryId: subcategory.id,
            expenseType: 'installment_instance',
            parentId: transaction.id,
            isProcessed: false,
        });
        if (i < numInstallments - 1) {
            currentPaymentDate = addMonths(currentPaymentDate, 1); // Assuming monthly
        }
    }
    return payments;
};

// POST /api/installment-transactions (Direct creation, alternative to unified /expenses)
router.post('/', authMiddleware, installmentValidationRules, async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const userId = req.user!.id;
    const { totalAmount, numberOfInstallments, subcategoryId, description, paymentMethod, firstPaymentDate } = req.body;

    try {
        const installmentRepo = AppDataSource.getRepository(InstallmentTransaction);
        const userRepo = AppDataSource.getRepository(User);
        const subcategoryRepo = AppDataSource.getRepository(Subcategory);
        const expenseRepo = AppDataSource.getRepository(Expense);

        const user = await userRepo.findOneBy({ id: userId });
        if (!user) return res.status(404).json({ message: "User not found" });

        const subcategory = await subcategoryRepo.findOne({ where: { id: parseInt(subcategoryId, 10), archived: false }, relations: ['category'] });
        if (!subcategory) return res.status(400).json({ message: "Subcategory not found or archived" });
        if (subcategory.category?.archived) return res.status(400).json({ message: "Parent category is archived" });

        const numInstall = parseInt(numberOfInstallments, 10);
        const total = parseFloat(totalAmount);
        const calculatedInstallmentAmount = parseFloat((total / numInstall).toFixed(2));

        const transaction = installmentRepo.create({
            userId, user, subcategoryId, subcategory,
            totalAmount: total,
            numberOfInstallments: numInstall,
            installmentAmount: calculatedInstallmentAmount,
            description, paymentMethod, firstPaymentDate,
            isCompleted: false,
        });
        const savedTransaction = await installmentRepo.save(transaction);

        // Generate payment instances
        const payments = await generateInstallmentPayments(savedTransaction, user, subcategory);
        if (payments.length > 0) {
            const expenseEntities = expenseRepo.create(payments);
            await expenseRepo.save(expenseEntities);
        }

        res.status(201).json({ message: `Installment transaction created with ${payments.length} payments.`, transaction: savedTransaction});

    } catch (error: any) {
        console.error("Error creating installment transaction:", error);
        res.status(500).json({ message: `Server Error: ${error.message}` });
    }
});


// GET /api/installment-transactions - Get all installment transactions for the user
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    try {
        const installmentRepo = AppDataSource.getRepository(InstallmentTransaction);
        const transactions = await installmentRepo.find({
            where: { userId },
            relations: ["subcategory", "subcategory.category"],
            order: { firstPaymentDate: "DESC" }
        });
        res.json(transactions);
    } catch (error: any) {
        console.error("Error fetching installment transactions:", error);
        res.status(500).json({ message: `Server Error: ${error.message}` });
    }
});

// GET /api/installment-transactions/:id - Get a specific installment transaction
router.get('/:id', authMiddleware, [param('id').isInt({gt:0})], async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const userId = req.user!.id;
    const transactionId = parseInt(req.params.id, 10);
    try {
        const installmentRepo = AppDataSource.getRepository(InstallmentTransaction);
        const transaction = await installmentRepo.findOne({
            where: { id: transactionId, userId },
            relations: ["subcategory", "subcategory.category"]
        });
        if (!transaction) return res.status(404).json({ message: "Installment transaction not found or access denied." });
        res.json(transaction);
    } catch (error: any) {
        console.error("Error fetching installment transaction:", error);
        res.status(500).json({ message: `Server Error: ${error.message}` });
    }
});


// PUT /api/installment-transactions/:id - Update an installment transaction (Limited for POC)
// Typically, once an installment plan starts, changing totalAmount or numberOfInstallments is complex.
// For POC, we might only allow updating description, paymentMethod, or marking as completed early.
router.put('/:id', authMiddleware, 
    [
        param('id').isInt({gt:0}),
        body('description').optional({nullable:true}).isString().trim().isLength({max: 500}),
        body('paymentMethod').optional({nullable:true}).isString().trim().isLength({max: 50}),
        body('isCompleted').optional().isBoolean(),
        // Prohibit changing core financial details like totalAmount, numberOfInstallments, firstPaymentDate
        // once created, via this endpoint. Such changes would require deleting and recreating.
        body('totalAmount').custom((value, {req}) => {
            if(req.body.totalAmount !== undefined) throw new Error('totalAmount cannot be modified after creation.');
            return true;
        }),
        body('numberOfInstallments').custom((value, {req}) => {
            if(req.body.numberOfInstallments !== undefined) throw new Error('numberOfInstallments cannot be modified after creation.');
            return true;
        }),
    ], 
    async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    
    const userId = req.user!.id;
    const transactionId = parseInt(req.params.id, 10);
    const updates = req.body;

    try {
        const installmentRepo = AppDataSource.getRepository(InstallmentTransaction);
        let transaction = await installmentRepo.findOneBy({id: transactionId, userId});
        if (!transaction) return res.status(404).json({message: "Transaction not found or access denied."});

        if (transaction.isCompleted && updates.isCompleted === false) {
            return res.status(400).json({message: "Cannot un-complete a completed transaction."});
        }

        // Allowed updates
        if (updates.description !== undefined) transaction.description = updates.description;
        if (updates.paymentMethod !== undefined) transaction.paymentMethod = updates.paymentMethod;
        if (updates.isCompleted !== undefined) {
            transaction.isCompleted = updates.isCompleted;
            if (transaction.isCompleted) {
                // Optional: Mark all remaining UNPROCESSED payments as "cancelled" or some other status
                // For now, just marking the definition.
                // This might also involve setting nextDueDate to null on related RecurringExpenseDefinition if that makes sense.
            }
        }
        
        const updatedTransaction = await installmentRepo.save(transaction);
        res.json(updatedTransaction);

    } catch (error: any) {
        console.error("Error updating installment transaction:", error);
        res.status(500).json({ message: `Server Error: ${error.message}` });
    }
});


// DELETE /api/installment-transactions/:id - Soft delete an installment transaction and its future instances
router.delete('/:id', authMiddleware, [param('id').isInt({gt:0})], async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const userId = req.user!.id;
    const transactionId = parseInt(req.params.id, 10);
    try {
        const installmentRepo = AppDataSource.getRepository(InstallmentTransaction);
        const expenseRepo = AppDataSource.getRepository(Expense);

        const transaction = await installmentRepo.findOneBy({id: transactionId, userId});
        if (!transaction) return res.status(404).json({message: "Transaction not found or access denied."});

        await AppDataSource.transaction(async transactionalEntityManager => {
            await transactionalEntityManager.getRepository(Expense).softDelete({
                parentId: transactionId,
                expenseType: 'installment_instance',
                isProcessed: false,
                userId: userId
            });
            await transactionalEntityManager.getRepository(InstallmentTransaction).softDelete({ id: transactionId, userId });
        });

        res.status(200).json({ message: "Installment transaction and its future payments soft deleted." });
    } catch (error: any) {
        console.error("Error deleting installment transaction:", error);
        res.status(500).json({ message: `Server Error: ${error.message}` });
    }
});

export default router;