// backend/src/data-source.ts
import "reflect-metadata";
import { DataSource, DataSourceOptions } from "typeorm";
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from "dotenv";

// --- Calculate __dirname for ESM context ---
// This will give the directory of the current file (e.g., /app/src when running from source)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// ---------------------------------------------

// --- Load .env file ---
// This attempts to load the .env file from the project root.
// It's mainly for local CLI runs. In Docker, Docker Compose injects environment variables.
// We check if POSTGRES_USER is already set (e.g., by Docker Compose) to avoid overriding.
if (!process.env.POSTGRES_USER) {
    const projectRootEnvPath = path.resolve(__dirname, '../../.env'); // Assumes data-source.ts is in backend/src
    console.log(`[data-source.ts] Attempting to load .env for CLI from: ${projectRootEnvPath}`);
    const dotenvResult = dotenv.config({ path: projectRootEnvPath });
    if (dotenvResult.error) {
        console.warn(`[data-source.ts] Warning: Could not load .env file from ${projectRootEnvPath}. Ensure environment variables are set if running CLI locally. Error: ${dotenvResult.error.message}`);
    } else {
        console.log(`[data-source.ts] .env file loaded from ${projectRootEnvPath}.`);
    }
}
// --------------------

// Determine DB host:
// 1. TYPEORM_CLI_HOST (for local CLI, usually 'localhost')
// 2. DB_HOST (from .env, usually 'db' for Docker network)
// 3. Default to 'db'
const dbHost = process.env.TYPEORM_CLI_HOST || process.env.DB_HOST || 'db';

// --- Logging for debugging ---
console.log("--- [data-source.ts] Effective Configuration ---");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("Calculated __dirname (source file location):", __dirname);
console.log("TYPEORM_CLI_HOST (process.env):", process.env.TYPEORM_CLI_HOST);
console.log("DB_HOST (process.env):", process.env.DB_HOST);
console.log("DB connection host will be:", dbHost);
console.log("DB_PORT (process.env):", process.env.DB_PORT);
console.log("POSTGRES_USER (process.env):", process.env.POSTGRES_USER);
console.log("POSTGRES_PASSWORD (is set in process.env):", !!process.env.POSTGRES_PASSWORD);
console.log("POSTGRES_DB (process.env):", process.env.POSTGRES_DB);

// Paths for TypeORM to find entities and migrations.
// These paths should point to where the *compiled JavaScript files* will be
// when the TypeORM CLI (or your application) runs, relative to the CWD of that process.
// When TypeORM CLI runs (via `npm run typeorm` in package.json), its CWD is `backend/`.
// Your `outDir` in tsconfig.json is "./dist".
// So, compiled entities will be in `backend/dist/entity` and migrations in `backend/dist/migration`.
const entitiesPath = "dist/entity/**/*.js";
const migrationsPath = "dist/migration/**/*.js";

console.log("Path for TypeORM entities (relative to backend CWD):", entitiesPath);
console.log("Path for TypeORM migrations (relative to backend CWD):", migrationsPath);
console.log("------------------------------------------------------");

export const AppDataSourceOptions: DataSourceOptions = {
    type: "postgres",
    host: dbHost,
    port: parseInt(process.env.DB_PORT || "5432", 10),
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
    synchronize: false, // Never use true in production
    logging: true, // Enable TypeORM logging, can be true or ["query", "error"]
    entities: ["dist/entity/User.js"],
    migrations: [migrationsPath],
    subscribers: [],
    migrationsTableName: "typeorm_migrations", // Optional: customize migrations table name
};

export const AppDataSource = new DataSource(AppDataSourceOptions);