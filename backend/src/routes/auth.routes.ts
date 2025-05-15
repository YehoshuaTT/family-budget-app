// backend/src/routes/auth.routes.ts
import { Router, Request, Response } from 'express';
import { AppDataSource } from '../data-source';
import { User } from '../entity/User';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import authMiddleware from '../middleware/auth.middleware'; // if not already imported
import { AuthenticatedRequest  } from '../middleware/auth.middleware'; // Import the interface for type safety

const router = Router();

// --- Signup Route ---
router.post(
    '/signup',
    [
        body('email').isEmail().withMessage('Please enter a valid email'),
        body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
        body('name').optional().isString().trim(), 
    ],
    async (req: Request, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password, name } = req.body;

        try {
            const userRepository = AppDataSource.getRepository(User);
            let user = await userRepository.findOneBy({ email });

            if (user) {
                return res.status(400).json({ message: 'User already exists' });
            }

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            user = userRepository.create({
                email,
                password: hashedPassword,
                name,
            });

            await userRepository.save(user);

            // אפשר גם ליצור JWT מיד לאחר הרשמה ולהחזיר אותו
            // const payload = { userId: user.id };
            // const token = jwt.sign(payload, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '1h' });
            // res.status(201).json({ token, userId: user.id, email: user.email });

            res.status(201).json({ message: 'User created successfully' });

        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Server error during signup' });
        }
    }
);

// --- Login Route ---
router.post(
    '/login',
    [
        body('email').isEmail().withMessage('Please enter a valid email'),
        body('password').exists().withMessage('Password is required'),
    ],
    async (req: Request, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;

        try {
            const userRepository = AppDataSource.getRepository(User);
            // חשוב להוסיף את 'password' ל-select כי הגדרנו select: false ב-Entity
            const user = await userRepository.createQueryBuilder("user")
                .addSelect("user.password")
                .where("user.email = :email", { email })
                .getOne();

            if (!user) {
                return res.status(400).json({ message: 'Invalid credentials (user not found)' });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(400).json({ message: 'Invalid credentials (password mismatch)' });
            }

            const payload = { userId: user.id };
            const token = jwt.sign(
                payload,
                process.env.JWT_SECRET || 'fallback_secret_please_change', // השתמש בסוד חזק מה-.env
                { expiresIn: '1h' } // או זמן אחר
            );

          
            res.json({
                token,
                user: { 
                    id: user.id,
                    email: user.email,
                    name: user.name,
                }
            });

        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Server error during login' });
        }
    },
    
router.get('/profile', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const userRepository = AppDataSource.getRepository(User);
        const user = await userRepository.findOne({
            where: { id: userId },
            // Select only the necessary fields to send to the client
            select: ["id", "email", "name", "createdAt"], 
        });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        res.json(user); // Send user object (without password)
    } catch (error) {
        console.error("Error fetching user profile:", error);
        res.status(500).json({ message: "Server error" });
    }
})
);

export default router;