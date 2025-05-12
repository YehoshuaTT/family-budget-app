// backend/src/data-source.ts
import "reflect-metadata";
import { DataSource, DataSourceOptions } from "typeorm";
import path from 'path';
import { ALL_ENTITIES } from './entity/index'; // No '.js'
// import dotenv from "dotenv"; // <<<< COMMENTED OUT or REMOVED

// --- Load .env file ---
// We are now relying on Docker Compose to inject environment variables
// const envPath = path.resolve(__dirname, '../../.env');
// console.log(`[data-source.ts] CJS __dirname: ${__dirname}`);
// console.log(`[data-source.ts] Attempting to load .env from: ${envPath}`);
// dotenv.config({ path: envPath }); // <<<< COMMENTED OUT or REMOVED
// -----------------------------------------

// Determine DB host:
// This will use process.env.TYPEORM_CLI_HOST if set (for local CLI runs),
// otherwise process.env.DB_HOST (injected by Docker Compose),
// or fallback to 'db'.
const dbHost = process.env.TYPEORM_CLI_HOST || process.env.DB_HOST || 'db';

// --- Logging ---
console.log("--- [data-source.ts] Effective Configuration ---");
console.log("NODE_ENV:", process.env.NODE_ENV); // See if this is set by Docker or locally
console.log("DB_HOST (from process.env directly):", process.env.DB_HOST); // Check what Docker Compose injected
console.log("DB connection host will be:", dbHost);
console.log("POSTGRES_USER (from process.env):", process.env.POSTGRES_USER);
// ... other relevant process.env logs ...

// Paths for TypeORM - Point to compiled JS files in 'dist'
const entitiesPath = path.join(__dirname, 'entity/**/*.js');
const migrationsPath = path.join(__dirname, 'migration/**/*.js'); // <<<< CHANGED BACK to **/*

console.log("Path for TypeORM entities:", entitiesPath);
console.log("Path for TypeORM migrations:", migrationsPath);
console.log("------------------------------------------------------");

export const AppDataSourceOptions: DataSourceOptions = {
    type: "postgres",
    host: dbHost,
    port: parseInt(process.env.DB_PORT || "5432", 10),
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
    synchronize: false,
    logging: process.env.NODE_ENV !== 'production',
    entities: ALL_ENTITIES,
    migrations: [migrationsPath],
    subscribers: [],
    migrationsTableName: "typeorm_migrations",
};

export const AppDataSource = new DataSource(AppDataSourceOptions);