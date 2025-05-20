// backend/src/index.ts (Updated)
import 'reflect-metadata'; // Must be first
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { AppDataSource } from './data-source';
import mainApiRouter from './routes/index'; // <<< ייבוא הראוטר הראשי

// Load environment variables VERY EARLY
const envPath = process.env.NODE_ENV === 'test'
    ? path.resolve(__dirname, '../../../.env.test')
    : path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

const app = express();

// Middlewares
app.use(cors()); 
app.use(express.json());

    const setupApp = () => { 
    app.get('/', (req: Request, res: Response) => {
        res.status(200).send('Hello from Budget App Backend!');
    });

    app.use('/api', mainApiRouter); // <<< שימוש בראוטר הראשי

    // Global error handler (example)
    app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
        console.error("Global Error Handler:", err.stack);
        res.status(500).send('Something broke!!');
    });
};

// --- Database Connection and Server Start Logic ---
const startServer = async () => {
    try {
        if (!AppDataSource.isInitialized) {
            await AppDataSource.initialize();
            console.log("Data Source has been initialized!");
        }
        
        setupApp(); // קריאה לפונקציה שמגדירה את האפליקציה (כולל הראוטים)

        const PORT = process.env.BACKEND_PORT_CONTAINER || 3001;
        const serverInstance = app.listen(PORT, () => { 
            console.log(`Backend server running at http://localhost:${PORT} (inside container)`);
        });
        return serverInstance;
    } catch (err) {
        console.error("Error during Data Source initialization or server start:", err);
        process.exit(1);
    }
};

if (require.main === module) {
    startServer();
}

export { app, startServer, AppDataSource };