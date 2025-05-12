// backend/src/routes/auth.routes.ts
import { Router, Request, Response } from 'express';
import { AppDataSource } from '../data-source';
import { User } from '../entity/User';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';

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
                userId: user.id,
                email: user.email,
                name: user.name,
            });

        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Server error during login' });
        }
    }
);

export default router;