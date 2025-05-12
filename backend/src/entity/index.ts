// backend/src/entity/index.ts

// Import all entities directly
import { User } from './User';
import { Category } from './Category';
import { Subcategory } from './Subcategory';
import { Income } from './Income';
import { Expense } from './Expense';
import { UserSettings } from './UserSettings';

// Export them in a single array
export const ALL_ENTITIES = [
  User,
  Category,
  Subcategory,
  Income,
  Expense,
  UserSettings,
];

// Optional: Re-export individually if needed elsewhere (probably not)
export { User, Category, Subcategory, Income, Expense, UserSettings };

// // check why i get this error backend-1  | Path for TypeORM migrations: /app/dist/migration/**/*.js
// backend-1  | ------------------------------------------------------
// backend-1  | Error during migration run:
// backend-1  | Error: getaddrinfo EAI_AGAIN db
// backend-1  |     at GetAddrInfoReqWrap.onlookup [as oncomplete] (node:dns:107:26) {
// backend-1  |   errno: -3001,
// backend-1  |   code: 'EAI_AGAIN',
// backend-1  |   syscall: 'getaddrinfo',
// backend-1  |   hostname: 'db'
// backend-1  | }
// PS C:\Users\a0526\DEV\family-budget-app-ts-minimal\backend> docker-compose exec backend sh
// service "backend" is not running
// PS C:\Users\a0526\DEV\family-budget-app-ts-minimal\backend> 

// // Check if the database is running
// docker-compose ps        its worloking
// docker-compose ps backend    not working
// docker-compose ps db        is    working
// docker-compose ps backend
// docker-compose ps backend    not working     