// backend/src/routes/userSettings.routes.ts
import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { AppDataSource } from '../data-source';
import { UserSettings } from '../entity/UserSettings';
import { User } from '../entity/User'; // Import User for associating
import authMiddleware, { AuthenticatedRequest } from '../middleware/auth.middleware';

const router = Router();

// GET /api/user-settings - Fetch settings for the authenticated user
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;

  try {
    const userSettingsRepository = AppDataSource.getRepository(UserSettings);
    let settings = await userSettingsRepository.findOne({
        where: { userId: userId },
        relations: ["user"] // Optionally load the user relation if needed in response, otherwise remove
    });

    if (!settings) {
      console.log(`No settings found for user ${userId}. Creating default settings.`);
      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOneBy({ id: userId });
      if (!user) {
        // This should ideally not happen if auth middleware worked and user exists
        return res.status(404).json({ message: "User not found to create settings." });
      }

      settings = userSettingsRepository.create({
        // userId: userId, // TypeORM infers this from the 'user' object if relation is set up
        user: user,       // Pass the User entity instance
        defaultCurrency: 'ILS',
        monthlyBudgetGoal: undefined, // Default to undefined if it's optional
      });
      await userSettingsRepository.save(settings);
    }
    
    // Prepare response, potentially excluding the full user object
    const { user, ...settingsToReturn } = settings;
    res.json(settingsToReturn);

  } catch (error: any) {
    console.error('Error fetching user settings:', error);
    res.status(500).json({ message: `Server error: ${error.message || 'Failed to fetch user settings'}` });
  }
});

// PUT /api/user-settings - Update settings for the authenticated user
router.put(
  '/',
  authMiddleware,
  [
    body('defaultCurrency').optional().isString().isLength({ min: 3, max: 3 }).withMessage('Currency must be a 3-letter code.'),
    body('monthlyBudgetGoal')
        .optional({ nullable: true }) // Allows the field to be absent or explicitly null from client
        .custom((value) => {
            if (value === null || value === undefined) return true; // Null or undefined are fine to indicate "not set" or "clear"
            const numValue = parseFloat(value);
            if (isNaN(numValue) || numValue < 0) {
                throw new Error('Monthly budget goal must be a non-negative number, null, or not provided.');
            }
            return true;
        })
        .customSanitizer(value => {
            if (value === null || value === undefined) return undefined; // Sanitize both null and undefined from client to undefined for the entity
            const num = parseFloat(value);
            return isNaN(num) ? undefined : num; // If parsing fails, treat as undefined
        }),
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user!.id;
    const updates = req.body; // updates.monthlyBudgetGoal will be number or undefined after sanitizer

    try {
      const userSettingsRepository = AppDataSource.getRepository(UserSettings);
      const userRepository = AppDataSource.getRepository(User); // For creating if not exists

      let settings = await userSettingsRepository.findOneBy({ userId: userId });

      if (!settings) {
        const user = await userRepository.findOneBy({ id: userId });
        if (!user) return res.status(404).json({ message: "User not found to create settings." });

        settings = userSettingsRepository.create({
          user: user,
          defaultCurrency: updates.defaultCurrency || 'ILS',
          // monthlyBudgetGoal from updates is already number or undefined
          monthlyBudgetGoal: updates.monthlyBudgetGoal !== undefined ? updates.monthlyBudgetGoal : undefined,
        });
      } else {
        // Update existing settings
        if (updates.defaultCurrency !== undefined) {
            settings.defaultCurrency = updates.defaultCurrency;
        }
        // Only update monthlyBudgetGoal if the key was actually sent in the request body
        // The value in 'updates' is already number or undefined due to sanitizer
        if (updates.hasOwnProperty('monthlyBudgetGoal')) {
            settings.monthlyBudgetGoal = updates.monthlyBudgetGoal;
        }
      }

      await userSettingsRepository.save(settings);
      
      const { user, ...settingsToReturn } = settings;
      res.json(settingsToReturn);

    } catch (error: any)
{
      console.error('Error updating user settings:', error);
      res.status(500).json({ message: `Server error: ${error.message || 'Failed to update user settings'}` });
    }
  }
);

export default router;