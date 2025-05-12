// backend/src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../data-source'; // ייבוא ה-DataSource
import { User } from '../entity/User';     // ייבוא מודל User

// הרחבת ממשק Request של Express כדי שיכיל את המשתמש
export interface AuthRequest extends Request {
    user?: User; // או רק userId: number;
}

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authentication token required' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret'); // השתמש בסוד מה-.env
        
        const userRepository = AppDataSource.getRepository(User);
        const user = await userRepository.findOneBy({ id: decoded.userId });

        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }

        req.user = user; // הוסף את אובייקט המשתמש לבקשה
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
};