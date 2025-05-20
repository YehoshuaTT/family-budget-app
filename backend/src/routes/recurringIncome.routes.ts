// backend/src/routes/recurringIncome.routes.ts
import { Router, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { AppDataSource } from '../data-source';
import { RecurringIncomeDefinition, Frequency } from '../entity/RecurringIncomeDefinition';
import { User } from '../entity/User';
import { Category } from '../entity/Category';
import authMiddleware, { AuthenticatedRequest } from '../middleware/auth.middleware';
import { format, parseISO, isValid as isValidDate, addMonths, addDays, addWeeks, addYears } from 'date-fns';
import { IsNull } from 'typeorm';
// In ו- IsNull לא נצטרך ישירות כאן אם QueryBuilder מטפל בזה נכון
// import { In, IsNull } from 'typeorm'; 

const router = Router();

const definitionValidationRules = [
    body('amount').notEmpty().withMessage('Amount is required.').isFloat({ gt: 0 }).withMessage('Amount must be a positive number.').toFloat(),
    body('description').optional({ nullable: true }).isString().trim().isLength({ max: 255 }).withMessage('Description cannot exceed 255 characters.'),
    body('frequency').isIn(['daily', 'weekly', 'monthly', 'bi-monthly', 'quarterly', 'semi-annually', 'annually']).withMessage('Invalid frequency.'),
    body('interval').optional({ checkFalsy: true }).isInt({ min: 1 }).withMessage('Interval must be a positive integer.').toInt().default(1), // Default to 1 if not provided
    body('startDate').notEmpty().withMessage('Start date is required.').isISO8601().withMessage('Invalid start date format (YYYY-MM-DD).').customSanitizer(value => format(parseISO(value), 'yyyy-MM-dd')),
    body('endDate').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('Invalid end date format (YYYY-MM-DD).').customSanitizer(value => value ? format(parseISO(value), 'yyyy-MM-dd') : undefined), // Sanitize to undefined
    body('occurrences').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }).withMessage('Occurrences must be a positive integer if provided.').toInt(),
    body('categoryId').optional({ checkFalsy: true }).isInt({ gt: 0 }).withMessage('Category ID must be a positive integer if provided.').toInt(),
    body().custom((value, { req }) => {
        if (req.body.endDate && req.body.occurrences) {
            throw new Error('Provide either endDate or occurrences for recurring income, not both.');
        }
        return true;
    }),
];

// Helper function to calculate next due date
const calculateNextDueDate = (currentStartDate: string, frequency: Frequency, interval: number): string => {
    let date = parseISO(currentStartDate);
    // Ensure interval is at least 1
    const safeInterval = Math.max(1, interval);

    switch (frequency) {
        case 'daily': date = addDays(date, safeInterval); break;
        case 'weekly': date = addWeeks(date, safeInterval); break;
        case 'monthly': date = addMonths(date, safeInterval); break;
        case 'bi-monthly': date = addMonths(date, 2 * safeInterval); break;
        case 'quarterly': date = addMonths(date, 3 * safeInterval); break;
        case 'semi-annually': date = addMonths(date, 6 * safeInterval); break;
        case 'annually': date = addYears(date, safeInterval); break;
        default: // Should not happen due to validation
            throw new Error(`Invalid frequency: ${frequency}`);
    }
    return format(date, 'yyyy-MM-dd');
};

// POST /api/recurring-income-definitions - Create new definition

router.post('/', authMiddleware, definitionValidationRules, async (req: AuthenticatedRequest, res: Response) => {
    console.log('--- Received body for POST /recurring-income-definitions: ---', req.body);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.error('Validation errors for recurring income:', errors.array());
        return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user!.id;
    const { amount, description, frequency, interval, startDate, endDate, occurrences, categoryId } = req.body;

    try {
        console.log('Attempting to get repositories for recurring income...');
        const definitionRepo = AppDataSource.getRepository(RecurringIncomeDefinition);
        const categoryRepo = AppDataSource.getRepository(Category);
        const userRepo = AppDataSource.getRepository(User);

        console.log(`Fetching user with ID: ${userId}`);
        const user = await userRepo.findOneBy({ id: userId });
        if (!user) {
            console.warn(`User not found for ID: ${userId} in POST recurring income`);
            return res.status(404).json({ message: "User not found" });
        }
        console.log('User found:', user.id);

        let categoryEntity: Category | null = null;
        if (categoryId) { // categoryId כבר מספר או undefined מהולידציה
            console.log(`Searching for category ID: ${categoryId} for user: ${userId} or global, type: income`);
            
            // --- שימוש ב-QueryBuilder לשליפת הקטגוריה ---
            categoryEntity = await categoryRepo.createQueryBuilder("cat")
                .where("cat.id = :id", { id: categoryId })
                .andWhere("cat.type = :type", { type: 'income' })
                .andWhere("cat.archived = :archived", { archived: false })
                .andWhere("(cat.userId = :userId OR cat.userId IS NULL)", { userId: userId })
                .getOne();
            // ------------------------------------------
            
            console.log('Found category for recurring income definition:', categoryEntity);
            if (!categoryEntity) {
                return res.status(400).json({ message: `Income category with ID ${categoryId} not found, is not type 'income', is archived, or not accessible to this user.` });
            }
        } else {
            console.log('No categoryId provided for recurring income.');
        }
        
        const parsedAmount = parseFloat(String(amount)); // ודא ש-amount הוא מספר
        const parsedInterval = parseInt(String(interval || "1"));
        console.log(`Calculating next due date with startDate: ${startDate}, frequency: ${frequency}, interval: ${parsedInterval}`);
        const nextDueDateValue = calculateNextDueDate(startDate, frequency as Frequency, parsedInterval);
        console.log('Calculated nextDueDate:', nextDueDateValue);

        const definitionData: Partial<RecurringIncomeDefinition> = {
            user: user,
            category: categoryEntity || undefined,
            categoryId: categoryEntity ? categoryEntity.id : undefined,
            amount: parsedAmount, 
            description: description || undefined,
            frequency: frequency as Frequency, 
            interval: parsedInterval, 
            startDate: startDate,
            endDate: endDate || undefined,
            occurrences: occurrences ? parseInt(String(occurrences)) : undefined,
            isActive: true,
            nextDueDate: nextDueDateValue,
        };
        console.log('--- Creating RecurringIncomeDefinition with data: ---', definitionData);
        
        const definition = definitionRepo.create(definitionData as RecurringIncomeDefinition);
        await definitionRepo.save(definition);
        console.log('--- RecurringIncomeDefinition saved: ---', definition);
        
        const savedDefinition = await definitionRepo.findOne({where: {id: definition.id}, relations: ['category']});
        res.status(201).json(savedDefinition);

    } catch (error: any) { 
        console.error("!!! Critical Error creating recurring income definition:", error);
        console.error("Error stack:", error.stack);
        res.status(500).json({ message: `Server error: ${error.message || "Failed to create recurring income definition"}`, details: error.toString() });
    }
});


// GET /api/recurring-income-definitions - Get all for user
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    try {
        const definitionRepo = AppDataSource.getRepository(RecurringIncomeDefinition);
        const definitions = await definitionRepo.find({
            where: { userId, deletedAt: IsNull() }, // Use IsNull() for TypeORM
            relations: ['category'],
            order: { startDate: 'DESC', createdAt: 'DESC' } // Add createdAt for tie-breaking
        });
        res.json(definitions);
    } catch (error: any) {
        console.error("Error fetching recurring income definitions:", error);
        res.status(500).json({ message: error.message || "Failed to fetch recurring income definitions"});
    }
});

// GET /api/recurring-income-definitions/:id - Get one
router.get('/:id', authMiddleware, [param('id').isInt({gt: 0}).withMessage('ID must be a positive integer.').toInt()], async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array()});

    const id = req.params.id as unknown as number; // Already toInt() by validator
    const userId = req.user!.id;
    try {
        const definitionRepo = AppDataSource.getRepository(RecurringIncomeDefinition);
        const definition = await definitionRepo.findOne({where: {id, userId, deletedAt: IsNull()}, relations: ['category']});
        if(!definition) return res.status(404).json({message: "Recurring income definition not found or access denied."});
        res.json(definition);
    } catch (error:any) { 
        console.error("Error fetching single recurring income definition:", error);
        res.status(500).json({ message: error.message || "Failed to fetch recurring income definition"});
    }
});

// PUT /api/recurring-income-definitions/:id - Update one
router.put('/:id', authMiddleware, [param('id').isInt({gt: 0}).withMessage('ID must be a positive integer.').toInt(), ...definitionValidationRules], async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array()});
    
    const id = req.params.id as unknown as number;
    const userId = req.user!.id;
    const { amount, description, frequency, interval, startDate, endDate, occurrences, categoryId, isActive } = req.body;

    try {
        const definitionRepo = AppDataSource.getRepository(RecurringIncomeDefinition);
        const categoryRepo = AppDataSource.getRepository(Category);
        let definition = await definitionRepo.findOneBy({id, userId, deletedAt: IsNull()});
        if(!definition) return res.status(404).json({message: "Recurring income definition not found or access denied for update."});

        let categoryEntity: Category | null = null;
        if (categoryId !== undefined) { // Check if categoryId was explicitly sent for update
            if(!(categoryId === null || categoryId === '')) { // Only update if a real category is provided
                categoryEntity = await categoryRepo.createQueryBuilder("cat")
                    .where("cat.id = :id", { id: categoryId })
                    .andWhere("cat.type = :type", { type: 'income' })
                    .andWhere("cat.archived = :archived", { archived: false })
                    .andWhere("(cat.userId = :userId OR cat.userId IS NULL)", { userId: userId })
                    .getOne();
                if (!categoryEntity) return res.status(400).json({ message: "Income category not found, not type 'income', is archived, or not accessible." });
                definition.category = categoryEntity;
                definition.categoryId = categoryEntity.id;
            }
            // else: if categoryId is null/empty, do not touch category/categoryId fields (leave as is)
        }


        definition.amount = amount; // Already float
        definition.description = description || undefined;
        definition.frequency = frequency as Frequency;
        definition.interval = interval; // Already number
        definition.startDate = startDate;
        definition.endDate = endDate || undefined;
        definition.occurrences = occurrences || undefined;
        
        if (isActive !== undefined) definition.isActive = isActive;
        
        definition.nextDueDate = calculateNextDueDate(definition.startDate, definition.frequency, definition.interval);

        await definitionRepo.save(definition);
        // Fetch again with relation to ensure consistent response
        const updatedDefinition = await definitionRepo.findOne({where: {id: definition.id}, relations: ['category']});
        res.json(updatedDefinition);
    } catch (error:any) { 
        console.error("Error updating recurring income definition:", error);
        res.status(500).json({ message: error.message || "Failed to update recurring income definition"});
    }
});

// DELETE /api/recurring-income-definitions/:id - Soft delete
router.delete('/:id', authMiddleware, [param('id').isInt({gt: 0}).withMessage('ID must be a positive integer.').toInt()], async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array()});

    const id = req.params.id as unknown as number;
    const userId = req.user!.id;
    try {
        const definitionRepo = AppDataSource.getRepository(RecurringIncomeDefinition);
        const result = await definitionRepo.softDelete({id, userId});
        if(result.affected === 0) return res.status(404).json({message: "Recurring income definition not found or access denied."});
        res.status(200).json({message: "Recurring income definition soft deleted"});
    } catch (error:any) { 
        console.error("Error soft-deleting recurring income definition:", error);
        res.status(500).json({ message: error.message || "Failed to soft-delete recurring income definition"});
    }
});

// PATCH /api/recurring-income-definitions/:id/restore - Restore soft deleted
router.patch('/:id/restore', authMiddleware, [param('id').isInt({gt: 0}).withMessage('ID must be a positive integer.').toInt()], async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array()});

    const id = req.params.id as unknown as number;
    const userId = req.user!.id;
    try {
        const definitionRepo = AppDataSource.getRepository(RecurringIncomeDefinition);
        // Check if it exists and belongs to user first (withDeleted true)
        const defToRestore = await definitionRepo.findOne({where: {id, userId}, withDeleted: true});
        if(!defToRestore) return res.status(404).json({message: "Definition not found or access denied."});
        if(!defToRestore.deletedAt) return res.status(400).json({message: "Definition is not deleted."});

        const result = await definitionRepo.restore({id, userId}); // restore might not check userId itself
        if(result.affected === 0) return res.status(404).json({message: "Definition not found or access denied (affected 0)."}); // Should not happen if found above
        res.status(200).json({message: "Recurring income definition restored"});
    } catch (error:any) { 
        console.error("Error restoring recurring income definition:", error);
        res.status(500).json({ message: error.message || "Failed to restore recurring income definition"});
    }
});

export default router;