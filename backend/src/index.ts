// backend/src/index.ts (Example CJS structure)
import 'reflect-metadata'; // Must be first
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { AppDataSource } from './data-source'; 

// Import routes...
import authRoutes from './routes/auth.routes'; 
import categoryRoutes from './routes/category.routes'; // Import
import incomeRoutes from './routes/income.routes'; // <<< ADD THIS IMPORT
import expenseRoutes from './routes/expense.routes'; // Import
import userSettingsRoutes from './routes/userSettings.routes'; // ADD THIS
import dashboardRoutes from './routes/dashboard.routes'; // ADD THIS
import recurringDefinitionRoutes from './routes/recurringDefinition.routes'; // ADD THIS
import installmentTransactionRoutes from './routes/installmentTransaction.routes'; // ADD THIS
import budgetProfileRoutes from './routes/budgetProfile.routes'; // ADD THIS
import budgetRoutes from './routes/budget.routes'; // ודא שזה קיים

// Load environment variables VERY EARLY
// Use __dirname (points to /app/dist usually at runtime)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const PORT = process.env.BACKEND_PORT || 3000;

// Middlewares
app.use(cors()); // Configure CORS properly for your frontend URL in production
app.use(express.json()); 
// --- Database Connection ---
AppDataSource.initialize()
.then(() => {
    console.log("Data Source has been initialized!");
    
    // --- Routes --- (Setup AFTER DB connection is successful)
    app.use('/api/auth', authRoutes);
    app.use('/api/user-settings', userSettingsRoutes); // ADD THIS
    app.use('/api/dashboard', dashboardRoutes); // ADD THIS
    app.use('/api/categories', categoryRoutes); // Register
    app.use('/api/incomes', incomeRoutes); // <<< ADD THIS LINE
    app.use('/api/expenses', expenseRoutes); // Register
    app.use('/api/recurring-definitions', recurringDefinitionRoutes); // ADD THIS
    app.use('/api/installment-transactions', installmentTransactionRoutes); // ADD THIS
    app.use('/api/budget-profiles', budgetProfileRoutes); // ADD THIS
    app.use('/api/budgets', budgetRoutes); // ודא שזה קיים

// Basic route
app.get('/', (req: Request, res: Response) => {
    res.send('Hello from Budget App Backend!');
});

// Global error handler (example)
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error("Global Error Handler:", err.stack);
    res.status(500).send('Something broke!');
});

// Start listening
app.listen(PORT, () => {
    console.log(`Backend server running at http://localhost:${PORT}`);
});

})
.catch((err) => {
        console.error("Error during Data Source initialization:", err);
        process.exit(1); // Exit if DB connection fails
    });