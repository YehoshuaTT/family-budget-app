// backend/src/routes/budgetProfile.routes.ts
import { Router, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { AppDataSource } from '../data-source';
import { BudgetProfile } from '../entity/BudgetProfile';
import { User } from '../entity/User'; // To associate with User
import authMiddleware, { AuthenticatedRequest } from '../middleware/auth.middleware';
import { format, parseISO, isValid as isValidDate } from 'date-fns';
import { Not } from 'typeorm'; 
const router = Router();

const currentYear = new Date().getFullYear();

// Validation rules for creating/updating a BudgetProfile
const budgetProfileValidationRules = [
  body('name').notEmpty().withMessage('Profile name is required.').isString().trim().isLength({ min: 2, max: 100 }),
  body('description').optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
  body('startDate').optional({ nullable: true }).isISO8601().withMessage('Start date must be valid (YYYY-MM-DD).')
    .customSanitizer(value => value ? format(parseISO(value), 'yyyy-MM-dd') : null),
  body('endDate').optional({ nullable: true }).isISO8601().withMessage('End date must be valid (YYYY-MM-DD).')
    .customSanitizer(value => value ? format(parseISO(value), 'yyyy-MM-dd') : null)
    .custom((value, { req }) => {
        if (value && req.body.startDate && parseISO(value) < parseISO(req.body.startDate)) {
            throw new Error('End date cannot be before start date.');
        }
        return true;
    }),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean.'),
];

// POST /api/budget-profiles - Create a new budget profile
router.post(
  '/',
  authMiddleware,
  budgetProfileValidationRules,
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user!.id;
    const { name, description, startDate, endDate, isActive } = req.body;

    try {
      const budgetProfileRepository = AppDataSource.getRepository(BudgetProfile);
      const userRepository = AppDataSource.getRepository(User);

      const user = await userRepository.findOneBy({ id: userId });
      if (!user) return res.status(404).json({ message: "User not found." });

      // If this profile is set to active, deactivate other profiles for this user
      if (isActive === true) {
        await budgetProfileRepository.update({ userId: userId, isActive: true }, { isActive: false });
      }

      const newProfile = budgetProfileRepository.create({
        name,
        description,
        startDate,
        endDate,
        isActive: isActive === undefined ? false : isActive, // Default to false if not provided
        user, // Associate the user object
        userId,
      });

      const savedProfile = await budgetProfileRepository.save(newProfile);
      res.status(201).json(savedProfile);

    } catch (error: any) {
      console.error('Error creating budget profile:', error);
      res.status(500).json({ message: `Server error: ${error.message || 'Failed to create budget profile'}` });
    }
  }
);

// GET /api/budget-profiles - Get all budget profiles for the user
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  try {
    const budgetProfileRepository = AppDataSource.getRepository(BudgetProfile);
    const profiles = await budgetProfileRepository.find({
      where: { userId },
      order: { isActive: "DESC", createdAt: "DESC" }, // Active ones first, then by creation
      // relations: ['budgetAllocations'] // Optionally load all allocations, can be heavy
    });
    res.json(profiles);
  } catch (error: any) {
    console.error('Error fetching budget profiles:', error);
    res.status(500).json({ message: `Server error: ${error.message || 'Failed to fetch budget profiles'}` });
  }
});

// GET /api/budget-profiles/:id - Get a specific budget profile
router.get(
  '/:id',
  authMiddleware,
  [param('id').isInt({ gt: 0 }).withMessage('Profile ID must be a positive integer.')],
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const userId = req.user!.id;
    const profileId = parseInt(req.params.id, 10);

    try {
      const budgetProfileRepository = AppDataSource.getRepository(BudgetProfile);
      const profile = await budgetProfileRepository.findOne({
        where: { id: profileId, userId },
        relations: ['budgetAllocations', 'budgetAllocations.subcategory', 'budgetAllocations.subcategory.category'] // Load allocations and their details
      });

      if (!profile) {
        return res.status(404).json({ message: 'Budget profile not found or access denied.' });
      }
      res.json(profile);
    } catch (error: any) {
      console.error('Error fetching budget profile:', error);
      res.status(500).json({ message: `Server error: ${error.message || 'Failed to fetch budget profile'}` });
    }
  }
);

// PUT /api/budget-profiles/:id - Update a budget profile
router.put(
  '/:id',
  authMiddleware,
  [
    param('id').isInt({ gt: 0 }).withMessage('Profile ID must be a positive integer.'),
    ...budgetProfileValidationRules // Reuse the same validation rules
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const userId = req.user!.id;
    const profileId = parseInt(req.params.id, 10);
    const updates = req.body;

    try {
      const budgetProfileRepository = AppDataSource.getRepository(BudgetProfile);
      let profile = await budgetProfileRepository.findOneBy({ id: profileId, userId });

      if (!profile) {
        return res.status(404).json({ message: 'Budget profile not found or access denied.' });
      }

      // If this profile is being set to active, deactivate others
      if (updates.isActive === true && !profile.isActive) { // Check if it's changing to active
        await budgetProfileRepository.update({ userId: userId, isActive: true, id: Not(profileId) }, { isActive: false });
      }

      // Apply updates
      if (updates.name !== undefined) profile.name = updates.name;
      if (updates.description !== undefined) profile.description = updates.description;
      if (updates.startDate !== undefined) profile.startDate = updates.startDate; // Already sanitized
      if (updates.endDate !== undefined) profile.endDate = updates.endDate; // Already sanitized
      if (updates.isActive !== undefined) profile.isActive = updates.isActive;

      const updatedProfile = await budgetProfileRepository.save(profile);
      res.json(updatedProfile);

    } catch (error: any) {
      console.error('Error updating budget profile:', error);
      res.status(500).json({ message: `Server error: ${error.message || 'Failed to update budget profile'}` });
    }
  }
);

// DELETE /api/budget-profiles/:id - Soft delete a budget profile
// This will also soft-delete associated Budget allocations due to cascade on the entity.
router.delete(
  '/:id',
  authMiddleware,
  [param('id').isInt({ gt: 0 }).withMessage('Profile ID must be a positive integer.')],
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const userId = req.user!.id;
    const profileId = parseInt(req.params.id, 10);

    try {
      const budgetProfileRepository = AppDataSource.getRepository(BudgetProfile);
      const result = await budgetProfileRepository.softDelete({ id: profileId, userId });

      if (result.affected === 0) {
        return res.status(404).json({ message: 'Budget profile not found or access denied.' });
      }
      res.status(200).json({ message: 'Budget profile (and its allocations) soft deleted successfully.' });
    } catch (error: any) {
      console.error('Error soft deleting budget profile:', error);
      res.status(500).json({ message: `Server error: ${error.message || 'Failed to soft delete budget profile'}` });
    }
  }
);

export default router;