// backend/src/routes/user.routes.ts
import { Router, Response }
from 'express';
import { body, validationResult } from 'express-validator';
import { AppDataSource } from '../data-source';
import { User } from '../entity/User';
import authMiddleware, { AuthenticatedRequest } from '../middleware/auth.middleware';

const router = Router();

// PUT /api/users/profile - עדכון פרטי פרופיל של המשתמש המחובר
router.put(
    '/profile', // הנתיב המלא יהיה /api/users/profile
    authMiddleware,
    [
        // ולידציה רק לשם כרגע
        body('name')
            .optional() // מאפשר לא לשלוח את השדה אם לא רוצים לעדכן אותו
            .isString().withMessage('Name must be a string.')
            .trim()
            .isLength({ min: 2 }).withMessage('Name must be at least 2 characters long.')
            .notEmpty().withMessage('Name cannot be empty if provided.'),
        // בעתיד אפשר להוסיף כאן ולידציות לשדות נוספים כמו email (עם לוגיקת אימות מורכבת יותר)
    ],
    async (req: AuthenticatedRequest, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const userId = req.user!.id; // מגיע מה-authMiddleware

        try {
            const userRepository = AppDataSource.getRepository(User);
            const userToUpdate = await userRepository.findOneBy({ id: userId });

            if (!userToUpdate) {
                // מקרה תיאורטי אם ה-middleware עבר אבל המשתמש נמחק איכשהו
                return res.status(404).json({ message: 'User not found' });
            }

            const { name /*, email, etc. */ } = req.body;

            // עדכן רק את השדות שנשלחו בגוף הבקשה ושמותר לעדכן
            if (name !== undefined) { // בדוק אם 'name' קיים בגוף הבקשה
                userToUpdate.name = name;
            }
            // אם תוסיף עדכון אימייל:
            // if (email !== undefined && email !== userToUpdate.email) {
            //   // TODO: Implement email change logic (e.g., verification of new email)
            //   // userToUpdate.email = email; // (after verification)
            //   // userToUpdate.isEmailVerified = false; // (if you have such a field)
            // }

            await userRepository.save(userToUpdate);

            // החזר את אובייקט המשתמש המעודכן, ללא הסיסמה
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { password, passwordResetToken, passwordResetExpires, ...userWithoutSensitiveData } = userToUpdate;
            res.json(userWithoutSensitiveData);

        } catch (error: any) {
            console.error('Error updating user profile:', error);
            res.status(500).json({ message: `Server error: ${error.message || 'Failed to update user profile'}` });
        }
    }
);

// GET /api/users/profile - קבלת פרטי הפרופיל של המשתמש המחובר
// (זה בעצם מה שהיה לך ב-GET /api/auth/profile, אפשר להעביר לכאן או להשאיר שם)
router.get('/profile', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    try {
        const userRepository = AppDataSource.getRepository(User);
        const user = await userRepository.findOneBy({ id: userId });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password, passwordResetToken, passwordResetExpires, ...userWithoutSensitiveData } = user;
        res.json(userWithoutSensitiveData);

    } catch (error: any) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ message: 'Server error' });
    }
});


export default router;