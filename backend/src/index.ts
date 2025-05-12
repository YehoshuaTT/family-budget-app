import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import 'reflect-metadata';
import { AppDataSource } from './data-source.js'; // Ensure .js extension
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url'; // <--- ייבוא חסר קודם
import authRoutes from './routes/auth.routes.js'; // ייבוא ה-Auth Routes


// --- Calculate __dirname and __filename for ESM ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename); // This __dirname will point to .../backend/src when running source
                                          // or .../backend/dist when running compiled code
// --------------------------------------------------

// Load .env from the project root if not running inside Docker where env_file is used
// __dirname for compiled code (dist/index.js) is /app/dist inside container.
// To get to project root .env, we need to go two levels up from /app/dist.
if (process.env.NODE_ENV !== 'docker_container') { // Only load if not in docker where env_file is used
    const envPath = path.resolve(__dirname, '../../.env'); // Correct path from dist/ to project root .env
    console.log(`[index.ts] Attempting to load .env from: ${envPath} (relative to ${__dirname})`);
    const dotenvResult = dotenv.config({ path: envPath });
    if (dotenvResult.error) {
        console.warn(`[index.ts] Warning: Could not load .env file from ${envPath}. Relying on preset environment variables. Error: ${dotenvResult.error.message}`);
    } else {
        console.log(`[index.ts] .env file loaded from ${envPath}.`);
    }
}

const app: Express = express();
const PORT = process.env.BACKEND_PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes); // הוספת ה-Auth Routes

app.get('/api/test', (req: Request, res: Response) => {
  res.json({ message: 'Test route is working!' });
});

app.get('/', (req: Request, res: Response) => {
    res.send('Family Budget Backend (TypeScript) is running!');
});

AppDataSource.initialize()
    .then(async () => {
        console.log("[index.ts] Data Source has been initialized for the server!");
        app.listen(PORT, () => {
            console.log(`[index.ts] Server is running on port ${PORT}`);
        });
    })
    .catch((error: any) => console.log("[index.ts] Error during Data Source initialization or server start:", error));