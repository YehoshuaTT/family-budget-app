// backend/src/migration/1747518848545-YourMigrationName.ts
import { MigrationInterface, QueryRunner } from "typeorm";

export class YourMigrationName1747518848545 implements MigrationInterface {
    name = 'YourMigrationName1747518848545'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // await queryRunner.query(`ALTER TABLE "budgets" DROP CONSTRAINT "FK_budgets_to_budget_profiles"`); // <<< שים שורה זו בהערה או מחק אותה

        // בדוק אם שאר ה-constraints שאתה מנסה למחוק עדיין קיימים ב-DB.
        // אם גם הם נמחקו ידנית, שים גם אותם בהערה.
        // אם הם קיימים, השאר את פקודות ה-DROP שלהם.
        // נניח כרגע שרק הראשון נמחק ידנית:
    //   await queryRunner.query(`ALTER TABLE "budget_profiles" DROP CONSTRAINT "FK_budget_profiles_to_users"`);
        // await queryRunner.query(`ALTER TABLE "budgets" DROP CONSTRAINT "UQ_budgets_profile_subcat_year_month"`);

        // פקודות ה-ADD נשארות כפי שהן
        // await queryRunner.query(`ALTER TABLE "budgets" ADD CONSTRAINT "UQ_68c1dff048d0ac88f76cd218c20" UNIQUE ("budgetProfileId", "subcategoryId", "year", "month")`);
        // await queryRunner.query(`ALTER TABLE "budgets" ADD CONSTRAINT "FK_49be2c7c59c73e53ec686888968" FOREIGN KEY ("budgetProfileId") REFERENCES "budget_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        // await queryRunner.query(`ALTER TABLE "budget_profiles" ADD CONSTRAINT "FK_cb0dc6354ad0e410e941a06ef16" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // חשוב מאוד: גם פונקציית ה-down צריכה להיות עקבית עם ה-up.
        // אם ה-up לא יצר את "FK_budgets_to_budget_profiles" (כי הוא כבר היה שם או שלא היה צריך אותו),
        // אז ה-down לא אמור לנסות למחוק constraint שלא נוצר על ידי ה-up הזה.
        // עם זאת, ה-down שלך מנסה לשחזר את המצב הקודם, כולל הוספה מחדש של ה-constraints המקוריים.

        // פקודות ה-DROP כאן צריכות להתייחס ל-constraints שנוצרו בפונקציית up
        await queryRunner.query(`ALTER TABLE "budget_profiles" DROP CONSTRAINT "FK_cb0dc6354ad0e410e941a06ef16"`);
        await queryRunner.query(`ALTER TABLE "budgets" DROP CONSTRAINT "FK_49be2c7c59c73e53ec686888968"`);
        await queryRunner.query(`ALTER TABLE "budgets" DROP CONSTRAINT "UQ_68c1dff048d0ac88f76cd218c20"`);
        
        // פקודות ה-ADD כאן מנסות לשחזר את ה-constraints שהיו לפני שהמיגרציה רצה
        await queryRunner.query(`ALTER TABLE "budgets" ADD CONSTRAINT "UQ_budgets_profile_subcat_year_month" UNIQUE ("year", "month", "subcategoryId", "budgetProfileId")`);
        await queryRunner.query(`ALTER TABLE "budget_profiles" ADD CONSTRAINT "FK_budget_profiles_to_users" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        
        // אם "FK_budgets_to_budget_profiles" לא היה קיים כשרצת up (כי מחקת אותו ידנית),
        // אז ה-ADD הזה כאן ינסה ליצור אותו מחדש. זה כנראה מה שאתה רוצה אם אתה עושה rollback.
        await queryRunner.query(`ALTER TABLE "budgets" ADD CONSTRAINT "FK_budgets_to_budget_profiles" FOREIGN KEY ("budgetProfileId") REFERENCES "budget_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }
}