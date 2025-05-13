// backend/src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../data-source'; // For fetching user if needed
import { User } from '../entity/User';         // For User type

// Define a custom property on Request to hold user info
export interface AuthenticatedRequest extends Request {
  user?: { // Make user optional as it's added by middleware
    id: number;
    // You could add more user properties here if you fetch the full user object
    // email?: string;
  };
}

const authMiddleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // 1. Get token from header
  const authHeader = req.header('Authorization');

  // 2. Check if token exists
  if (!authHeader) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  // Check if it's a Bearer token
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ message: 'Token error, format is "Bearer <token>"' });
  }

  const token = parts[1];

  try {
    // 3. Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_please_change') as { userId: number; iat: number; exp: number };
    // The 'as { userId: number; ... }' is a type assertion for the decoded payload.

    // 4. Add user ID from payload to request object
    // We are sure userId exists in the payload due to how we created the token in auth.routes.ts
    req.user = { id: decoded.userId };

    // Optional: Fetch the full user object from DB if needed by subsequent handlers
    // This makes an extra DB call for every authenticated request.
    // Consider if you really need the full user object in `req.user` or if `userId` is enough.
    /*
    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOneBy({ id: decoded.userId });

    if (!user) {
      return res.status(401).json({ message: 'Token is valid, but user not found' });
    }
    // If fetching full user, assign it:
    // req.user = { id: user.id, email: user.email, ...other fields }; // Add more fields if needed
    */

    next(); // Pass control to the next middleware/handler
  } catch (err) {
    // Handle different JWT errors
    if (err instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ message: 'Token is expired' });
    }
    if (err instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ message: 'Token is not valid' });
    }
    // For other errors (e.g., JWT_SECRET missing, though unlikely here if server starts)
    console.error('Error in auth middleware:', err);
    return res.status(500).json({ message: 'Server error during token authentication' });
  }
};

export default authMiddleware;