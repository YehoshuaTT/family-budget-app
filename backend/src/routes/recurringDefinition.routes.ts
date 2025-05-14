// backend/src/routes/recurringDefinition.routes.ts
import { Router, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { AppDataSource } from '../data-source';
import { RecurringExpenseDefinition, Frequency } from '../entity/RecurringExpenseDefinition';
import { Expense } from '../entity/Expense';
import { User } from '../entity/User'; // If needed for explicit user object association
import { Subcategory } from '../entity/Subcategory';
import authMiddleware, { AuthenticatedRequest } from '../middleware/auth.middleware';
import { format, parseISO, addMonths, isValid as isValidDate } from 'date-fns';
import { In } from 'typeorm';


const router = Router();

// --- Validation Rules for Create/Update Recurring Definition ---
const recurringDefinitionValidationRules = [
  body('amount').notEmpty().isNumeric().custom(v => parseFloat(v) > 0).withMessage('Amount must be a positive number.'),
  body('subcategoryId').notEmpty().isInt({ gt: 0 }).withMessage('Subcategory ID must be a positive integer.'),
  body('description').optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
  body('paymentMethod').optional({ nullable: true }).isString().trim().isLength({ max: 50 }),
  body('frequency').notEmpty().isIn(['daily', 'weekly', 'monthly', 'bi-monthly', 'quarterly', 'semi-annually', 'annually']).withMessage('Invalid frequency.'),
  body('interval').optional().isInt({ gt: 0 }).withMessage('Interval must be a positive integer.'),
  body('startDate').notEmpty().isISO8601().withMessage('Start date must be a valid date (YYYY-MM-DD).')
    .customSanitizer(value => value ? format(parseISO(value), 'yyyy-MM-dd') : null),
  body('endDate').optional({ nullable: true }).isISO8601().withMessage('End date must be a valid date (YYYY-MM-DD) if provided.')
    .customSanitizer(value => value ? format(parseISO(value), 'yyyy-MM-dd') : null)
    .custom((value, { req }) => {
        if (value && req.body.startDate && parseISO(value) < parseISO(req.body.startDate)) {
            throw new Error('End date cannot be before start date.');
        }
        if (value && req.body.occurrences) {
            throw new Error('Provide either endDate or occurrences, not both.');
        }
        return true;
    }),
  body('occurrences').optional({ nullable: true }).isInt({ gt: 0 }).withMessage('Occurrences must be a positive integer if provided.'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean.'),
];

// Helper to generate expense instances for a recurring definition
const generateRecurringInstances = async (definition: RecurringExpenseDefinition, user: User, subcategory: Subcategory): Promise<Partial<Expense>[]> => {
    const instances: Partial<Expense>[] = [];
    if (!definition.isActive) return instances; // Don't generate for inactive definitions

    let currentDueDate = parseISO(definition.startDate);
    const finalEndDate = definition.endDate ? parseISO(definition.endDate) : null;
    let occurrencesCount = 0;
    const MAX_INSTANCES = 365 * 2; // Safety limit

    while (instances.length < MAX_INSTANCES) {
        if (finalEndDate && currentDueDate > finalEndDate) break;
        if (definition.occurrences && occurrencesCount >= definition.occurrences) break;

        instances.push({
            amount: definition.amount,
            date: format(currentDueDate, 'yyyy-MM-dd'),
            description: definition.description,
            paymentMethod: definition.paymentMethod,
            user: user, // Pass the User entity
            userId: user.id,
            subcategory: subcategory, // Pass the Subcategory entity
            subcategoryId: subcategory.id,
            expenseType: 'recurring_instance',
            parentId: definition.id,
            isProcessed: false,
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
            default: throw new Error('Invalid frequency in instance generation');
        }
    }
    return instances;
};


// POST /api/recurring-definitions (Used if creating definition directly, not via unified /expenses)
// This is a more direct way to create a definition if the unified POST /api/expenses becomes too complex for frontend
router.post('/', authMiddleware, recurringDefinitionValidationRules, async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const userId = req.user!.id;
    const { amount, subcategoryId, description, paymentMethod, frequency, interval = 1, startDate, endDate, occurrences, isActive = true } = req.body;

    try {
        const recurringRepo = AppDataSource.getRepository(RecurringExpenseDefinition);
        const userRepo = AppDataSource.getRepository(User);
        const subcategoryRepo = AppDataSource.getRepository(Subcategory);
        const expenseRepo = AppDataSource.getRepository(Expense);

        const user = await userRepo.findOneBy({ id: userId });
        if (!user) return res.status(404).json({ message: "User not found" });

        const subcategory = await subcategoryRepo.findOne({ where: { id: parseInt(subcategoryId, 10), archived: false }, relations: ['category'] });
        if (!subcategory) return res.status(400).json({ message: "Subcategory not found or archived" });
        if (subcategory.category?.archived) return res.status(400).json({ message: "Parent category is archived" });

        const definition = recurringRepo.create({
            userId, user, subcategoryId, subcategory,
            amount: parseFloat(amount), description, paymentMethod,
            frequency: frequency as Frequency,
            interval: parseInt(interval.toString(), 10), // Ensure interval is number
            startDate, endDate,
            occurrences: occurrences ? parseInt(occurrences, 10) : null,
            isActive,
            nextDueDate: startDate // Initial next due date
        });
        const savedDefinition = await recurringRepo.save(definition);

        // Generate instances
        if (savedDefinition.isActive) {
            const instances = await generateRecurringInstances(savedDefinition, user, subcategory);
            if (instances.length > 0) {
                const expenseEntities = expenseRepo.create(instances);
                await expenseRepo.save(expenseEntities);
                 // Update nextDueDate on the definition based on the last generated instance + interval
                if (instances.length > 0) {
                    const lastInstanceDate = parseISO(instances[instances.length - 1].date!);
                    let nextCalculatedDueDate : Date;
                    switch (savedDefinition.frequency) {
                        case 'daily': nextCalculatedDueDate = new Date(lastInstanceDate); nextCalculatedDueDate.setDate(lastInstanceDate.getDate() + savedDefinition.interval); break;
                        case 'weekly': nextCalculatedDueDate = new Date(lastInstanceDate); nextCalculatedDueDate.setDate(lastInstanceDate.getDate() + (7 * savedDefinition.interval)); break;
                        // ... add other frequencies
                        default: nextCalculatedDueDate = addMonths(lastInstanceDate, savedDefinition.interval); // Default for monthly etc.
                    }
                     // Check if nextCalculatedDueDate is beyond endDate or occurrences limit
                    if ( (savedDefinition.endDate && nextCalculatedDueDate > parseISO(savedDefinition.endDate)) ||
                         (savedDefinition.occurrences && instances.length >= savedDefinition.occurrences) ) {
                        savedDefinition.nextDueDate = null; // No more occurrences
                        savedDefinition.isActive = false; // Mark as inactive if all occurrences generated
                    } else {
                        savedDefinition.nextDueDate = format(nextCalculatedDueDate, 'yyyy-MM-dd');
                    }
                    await recurringRepo.save(savedDefinition); // Save updated nextDueDate / isActive
                }
            }
        }

        res.status(201).json(savedDefinition);
    } catch (error: any) {
        console.error("Error creating recurring definition:", error);
        res.status(500).json({ message: `Server Error: ${error.message}` });
    }
});


// GET /api/recurring-definitions - Get all recurring expense definitions for the user
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    try {
        const recurringRepo = AppDataSource.getRepository(RecurringExpenseDefinition);
        const definitions = await recurringRepo.find({
            where: { userId },
            relations: ["subcategory", "subcategory.category"], // Load related data for display
            order: { startDate: "DESC" }
        });
        res.json(definitions);
    } catch (error: any) {
        console.error("Error fetching recurring definitions:", error);
        res.status(500).json({ message: `Server Error: ${error.message}` });
    }
});

// GET /api/recurring-definitions/:id - Get a specific recurring definition
router.get('/:id', authMiddleware, [param('id').isInt({gt:0})], async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    
    const userId = req.user!.id;
    const definitionId = parseInt(req.params.id, 10);
    try {
        const recurringRepo = AppDataSource.getRepository(RecurringExpenseDefinition);
        const definition = await recurringRepo.findOne({
            where: { id: definitionId, userId },
            relations: ["subcategory", "subcategory.category"]
        });
        if (!definition) return res.status(404).json({ message: "Recurring definition not found or access denied." });
        res.json(definition);
    } catch (error: any) {
        console.error("Error fetching recurring definition:", error);
        res.status(500).json({ message: `Server Error: ${error.message}` });
    }
});

// PUT /api/recurring-definitions/:id - Update a recurring expense definition
// Note: This is complex. For POC, we might only allow updating non-critical fields or isActive.
// Regenerating instances based on changed frequency/dates is a heavy operation.
router.put('/:id', authMiddleware, 
    [param('id').isInt({gt:0}), ...recurringDefinitionValidationRules], 
    async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const userId = req.user!.id;
    const definitionId = parseInt(req.params.id, 10);
    const updates = req.body;

    try {
        const recurringRepo = AppDataSource.getRepository(RecurringExpenseDefinition);
        const expenseRepo = AppDataSource.getRepository(Expense);
        const userRepo = AppDataSource.getRepository(User);
        const subcategoryRepo = AppDataSource.getRepository(Subcategory);

        let definition = await recurringRepo.findOneBy({ id: definitionId, userId });
        if (!definition) return res.status(404).json({ message: "Definition not found or access denied." });

        const user = await userRepo.findOneByOrFail({id: userId});
        
        // Fields that might trigger regeneration of instances
        const criticalFieldsChanged = 
            (updates.amount && parseFloat(updates.amount) !== parseFloat(definition.amount as any)) ||
            (updates.frequency && updates.frequency !== definition.frequency) ||
            (updates.interval && parseInt(updates.interval, 10) !== definition.interval) ||
            (updates.startDate && format(parseISO(updates.startDate), 'yyyy-MM-dd') !== definition.startDate) ||
            (updates.endDate !== undefined && (updates.endDate === null ? null : format(parseISO(updates.endDate), 'yyyy-MM-dd')) !== definition.endDate) || // check for null explicitly
            (updates.occurrences !== undefined && (updates.occurrences === null ? null : parseInt(updates.occurrences, 10)) !== definition.occurrences);


        // Update definition fields
        definition.amount = updates.amount !== undefined ? parseFloat(updates.amount) : definition.amount;
        definition.description = updates.description !== undefined ? updates.description : definition.description;
        definition.paymentMethod = updates.paymentMethod !== undefined ? updates.paymentMethod : definition.paymentMethod;
        definition.frequency = updates.frequency !== undefined ? updates.frequency as Frequency : definition.frequency;
        definition.interval = updates.interval !== undefined ? parseInt(updates.interval, 10) : definition.interval;
        definition.startDate = updates.startDate !== undefined ? format(parseISO(updates.startDate), 'yyyy-MM-dd') : definition.startDate;
        definition.endDate = updates.endDate !== undefined ? (updates.endDate === null ? null : format(parseISO(updates.endDate), 'yyyy-MM-dd')) : definition.endDate;
        definition.occurrences = updates.occurrences !== undefined ? (updates.occurrences === null ? null : parseInt(updates.occurrences, 10)) : definition.occurrences;
        definition.isActive = updates.isActive !== undefined ? updates.isActive : definition.isActive;
        
        if (updates.subcategoryId && parseInt(updates.subcategoryId, 10) !== definition.subcategoryId) {
            const newSubcategory = await subcategoryRepo.findOne({ where: { id: parseInt(updates.subcategoryId, 10), archived: false }, relations: ['category'] });
            if (!newSubcategory) return res.status(400).json({ message: "New subcategory not found or archived" });
            if (newSubcategory.category?.archived) return res.status(400).json({ message: "New parent category is archived" });
            definition.subcategory = newSubcategory;
            definition.subcategoryId = newSubcategory.id;
        }
        
        // For simplicity in POC, if critical fields change, we will:
        // 1. Delete old UNPROCESSED instances.
        // 2. Generate new instances based on updated definition.
        // 3. Update nextDueDate.
        // This does NOT handle changes to processed (historical) instances.
        if (criticalFieldsChanged || (updates.isActive !== undefined && updates.isActive !== definition.isActive)) {
            console.log("Critical fields changed or isActive status changed, regenerating instances for definition ID:", definition.id);
            // Delete old unprocessed instances
            await expenseRepo.softDelete({ 
                parentId: definition.id, 
                expenseType: 'recurring_instance', 
                isProcessed: false,
                userId: userId // Ensure we only delete user's instances
            });
            console.log("Deleted old unprocessed instances.");

            if (definition.isActive) { // Only generate new instances if definition is now active
                const newInstances = await generateRecurringInstances(definition, user, definition.subcategory!); // User and subcategory should be loaded
                if (newInstances.length > 0) {
                    const newExpenseEntities = expenseRepo.create(newInstances);
                    await expenseRepo.save(newExpenseEntities);
                    console.log(`Generated ${newInstances.length} new instances.`);
                    // Update nextDueDate (simplified - assumes first new instance date is next due if startDate changed)
                    // More robust logic needed for nextDueDate if startDate didn't change but other params did
                    const firstNewInstanceDate = parseISO(newInstances[0].date!);
                    let nextCalculatedDueDate: Date;
                    switch (definition.frequency) {
                        case 'daily': nextCalculatedDueDate = new Date(firstNewInstanceDate); nextCalculatedDueDate.setDate(firstNewInstanceDate.getDate() + definition.interval); break;
                        case 'weekly': nextCalculatedDueDate = new Date(firstNewInstanceDate); nextCalculatedDueDate.setDate(firstNewInstanceDate.getDate() + (7 * definition.interval)); break;
                        default: nextCalculatedDueDate = addMonths(firstNewInstanceDate, definition.interval);
                    }
                    if ( (definition.endDate && nextCalculatedDueDate > parseISO(definition.endDate)) ||
                         (definition.occurrences && newInstances.length >= definition.occurrences) ) { // If first instance is already the last
                        definition.nextDueDate = null;
                        definition.isActive = false; // if the regeneration created all possible instances
                    } else {
                        definition.nextDueDate = format(nextCalculatedDueDate, 'yyyy-MM-dd');
                    }
                } else {
                    definition.nextDueDate = null; // No instances to generate means no next due date
                    if (!definition.endDate && !definition.occurrences) definition.isActive = false; // If it became inactive due to no possible instances
                }
            } else { // Definition is now inactive
                definition.nextDueDate = null;
                console.log("Definition is inactive, no new instances generated.");
            }
        } else if (definition.isActive && !definition.nextDueDate) {
             // If it's active but has no next due date (e.g. from previous state), recalculate based on last known instance or start date
             // This part can be complex and might be better handled by a dedicated "recalculate next due date" function
             // For POC, if instances were not regenerated, nextDueDate remains as is or needs simple logic if startDate changed.
             if (updates.startDate) definition.nextDueDate = definition.startDate; // Simplistic update
        }


        const updatedDefinition = await recurringRepo.save(definition);
        res.json(updatedDefinition);

    } catch (error: any) {
        console.error("Error updating recurring definition:", error);
        res.status(500).json({ message: `Server Error: ${error.message}` });
    }
});


// DELETE /api/recurring-definitions/:id - Soft delete a recurring definition and its future instances
router.delete('/:id', authMiddleware, [param('id').isInt({gt:0})], async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const userId = req.user!.id;
    const definitionId = parseInt(req.params.id, 10);
    try {
        const recurringRepo = AppDataSource.getRepository(RecurringExpenseDefinition);
        const expenseRepo = AppDataSource.getRepository(Expense);

        const definition = await recurringRepo.findOneBy({id: definitionId, userId});
        if (!definition) return res.status(404).json({message: "Definition not found or access denied."});

        // Start a transaction to ensure atomicity
        await AppDataSource.transaction(async transactionalEntityManager => {
            // 1. Soft delete future (unprocessed) expense instances linked to this definition
            await transactionalEntityManager.getRepository(Expense).softDelete({
                parentId: definitionId,
                expenseType: 'recurring_instance',
                isProcessed: false,
                userId: userId // Ensure user ownership
            });
            console.log(`Soft deleted unprocessed instances for definition ID: ${definitionId}`);

            // 2. Soft delete the definition itself
            await transactionalEntityManager.getRepository(RecurringExpenseDefinition).softDelete({ id: definitionId, userId });
            console.log(`Soft deleted definition ID: ${definitionId}`);
        });

        res.status(200).json({ message: "Recurring definition and its future instances soft deleted." });
    } catch (error: any) {
        console.error("Error deleting recurring definition:", error);
        res.status(500).json({ message: `Server Error: ${error.message}` });
    }
});


export default router;