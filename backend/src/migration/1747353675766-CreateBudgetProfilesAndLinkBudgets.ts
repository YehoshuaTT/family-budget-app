
import { MigrationInterface, QueryRunner } from "typeorm";
import { format, startOfYear } from 'date-fns'; // Import date-fns functions

export class CreateBudgetProfilesAndLinkBudgets1747353675766 implements MigrationInterface {
    name = 'CreateBudgetProfilesAndLinkBudgets1747353675766'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Drop the old unique constraint (if it exists and you know its name)
        // It's safer to check if it exists first or use IF EXISTS if your DB supports it.
        // The name "UQ_9d5dbf6a0437be47652524a7178" seems to be a TypeORM generated name.
        try {
            await queryRunner.query(`ALTER TABLE "budgets" DROP CONSTRAINT "UQ_9d5dbf6a0437be47652524a7178"`);
            console.log("Old unique constraint on budgets dropped.");
        } catch (e) {
            console.log("Could not drop old unique constraint UQ_9d5dbf6a0437be47652524a7178 (it might not exist or name is different). This might be OK.");
        }

        // 2. Create the new "budget_profiles" table
        await queryRunner.query(
            `CREATE TABLE "budget_profiles" (
                "id" SERIAL NOT NULL, 
                "name" character varying(100) NOT NULL, 
                "description" text, 
                "startDate" date, 
                "endDate" date, 
                "isActive" boolean NOT NULL DEFAULT false, 
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(), 
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), 
                "deletedAt" TIMESTAMP, 
                "userId" integer NOT NULL, 
                CONSTRAINT "PK_budget_profiles_id" PRIMARY KEY ("id")
            )`
        );
        console.log("Table 'budget_profiles' created.");

        // 3. Add "deletedAt" to "budgets" table
        await queryRunner.query(`ALTER TABLE "budgets" ADD "deletedAt" TIMESTAMP`);
        console.log("Column 'deletedAt' added to 'budgets'.");

        // 4. Add "budgetProfileId" to "budgets" table, initially NULLABLE
        await queryRunner.query(`ALTER TABLE "budgets" ADD "budgetProfileId" integer`);
        console.log("Column 'budgetProfileId' added as NULLABLE to 'budgets'.");

        // --- Logic to handle existing data in "budgets" table ---
        // Get all distinct userIds that have existing budget entries
        const existingUserIdsWithBudgets: { userId: number }[] = await queryRunner.query(
            `SELECT DISTINCT "userId" FROM "budgets" WHERE "budgetProfileId" IS NULL`
        );
        console.log(`Found ${existingUserIdsWithBudgets.length} users with existing budgets to migrate.`);

        if (existingUserIdsWithBudgets.length > 0) {
            for (const row of existingUserIdsWithBudgets) {
                const userId = row.userId;
                if (userId === null || userId === undefined) { // Safety check
                    console.warn(`Skipping budget migration for NULL userId row:`, row);
                    continue;
                }

                const defaultProfileName = `תקציב ראשי ${new Date().getFullYear()}`; // Default name
                const defaultStartDate = format(startOfYear(new Date()), 'yyyy-MM-dd');

                // Insert a default budget_profile for this user
                // Use query parameters to prevent SQL injection, even with internal data
                const profileInsertResult = await queryRunner.query(
                    `INSERT INTO "budget_profiles" ("name", "userId", "isActive", "startDate") 
                     VALUES ($1, $2, $3, $4) RETURNING id`,
                    [defaultProfileName, userId, true, defaultStartDate] // isActive true for the default
                );
                
                if (!profileInsertResult || profileInsertResult.length === 0 || !profileInsertResult[0].id) {
                    console.error(`Failed to create default budget profile for userId: ${userId}`);
                    // Decide how to handle this: throw error to stop migration, or log and continue?
                    // For now, let's throw to ensure data integrity.
                    throw new Error(`Failed to create or retrieve ID for default budget profile for userId: ${userId}`);
                }
                const newProfileId = profileInsertResult[0].id;
                console.log(`Created default BudgetProfile (ID: ${newProfileId}) for User ID: ${userId}`);

                // Update existing budget entries for this user to link to the new default profile
                await queryRunner.query(
                    `UPDATE "budgets" SET "budgetProfileId" = $1 
                     WHERE "userId" = $2 AND "budgetProfileId" IS NULL`,
                    [newProfileId, userId]
                );
                console.log(`Updated existing budgets for User ID: ${userId} to link to Profile ID: ${newProfileId}`);
            }
        }
        // --- End of logic for existing data ---

        // 5. Now that existing rows should have a budgetProfileId, alter the column to NOT NULL
        //    (Only if all rows were successfully updated. Add a check if necessary)
        const unlinkedBudgets = await queryRunner.query(`SELECT COUNT(*) as count FROM "budgets" WHERE "budgetProfileId" IS NULL`);
        if (parseInt(unlinkedBudgets[0].count) === 0) {
            await queryRunner.query(`ALTER TABLE "budgets" ALTER COLUMN "budgetProfileId" SET NOT NULL`);
            console.log("Column 'budgetProfileId' in 'budgets' altered to NOT NULL.");
        } else {
            console.warn(`WARNING: Could not alter 'budgetProfileId' to NOT NULL because ${unlinkedBudgets[0].count} rows still have NULL. Migration might be incomplete for these rows.`);
            // This indicates an issue in the data migration logic above or pre-existing NULL userIds in budgets.
        }


        // 6. Add the new unique constraint to "budgets"
        await queryRunner.query(`ALTER TABLE "budgets" ADD CONSTRAINT "UQ_budgets_profile_subcat_year_month" UNIQUE ("budgetProfileId", "subcategoryId", "year", "month")`);
        console.log("New unique constraint added to 'budgets'.");

        // 7. Add foreign key constraint from "budgets" to "budget_profiles"
        await queryRunner.query(`ALTER TABLE "budgets" ADD CONSTRAINT "FK_budgets_to_budget_profiles" FOREIGN KEY ("budgetProfileId") REFERENCES "budget_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        console.log("Foreign key from 'budgets' to 'budget_profiles' added.");

        // 8. Add foreign key constraint from "budget_profiles" to "users"
        await queryRunner.query(`ALTER TABLE "budget_profiles" ADD CONSTRAINT "FK_budget_profiles_to_users" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        console.log("Foreign key from 'budget_profiles' to 'users' added.");
    }

    // ... (פונקציית down שלך נראית בסדר, רק ודא שהשמות של האילוצים תואמים)
    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "budget_profiles" DROP CONSTRAINT "FK_budget_profiles_to_users"`);
        await queryRunner.query(`ALTER TABLE "budgets" DROP CONSTRAINT "FK_budgets_to_budget_profiles"`);
        await queryRunner.query(`ALTER TABLE "budgets" DROP CONSTRAINT "UQ_budgets_profile_subcat_year_month"`);
        
        // Make budgetProfileId nullable again before dropping if it was set to NOT NULL
        // This depends on whether the up() successfully made it NOT NULL.
        // For safety, you might check if the column is not null before trying to drop the constraint.
        // await queryRunner.query(`ALTER TABLE "budgets" ALTER COLUMN "budgetProfileId" DROP NOT NULL`);
        
        await queryRunner.query(`ALTER TABLE "budgets" DROP COLUMN "budgetProfileId"`);
        await queryRunner.query(`ALTER TABLE "budgets" DROP COLUMN "deletedAt"`);
        await queryRunner.query(`DROP TABLE "budget_profiles"`);
        
        // Add back the old unique constraint if it was indeed "UQ_9d5dbf6a0437be47652524a7178"
        // Ensure the columns are correct for the old constraint
        try {
            await queryRunner.query(`ALTER TABLE "budgets" ADD CONSTRAINT "UQ_9d5dbf6a0437be47652524a7178" UNIQUE ("year", "month", "userId", "subcategoryId")`);
            console.log("Old unique constraint on budgets restored.");
        } catch (e) {
            console.log("Could not restore old unique constraint UQ_9d5dbf6a0437be47652524a7178. It might not have been the correct one or columns changed.");
        }
    }
}

