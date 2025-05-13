import { MigrationInterface, QueryRunner } from "typeorm";

export class FixExpensesTable1747167843947 implements MigrationInterface {
    name = 'FixExpensesTable1747167843947'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "recurring_expense_definitions" ("id" SERIAL NOT NULL, "amount" numeric(10,2) NOT NULL, "description" text, "paymentMethod" character varying(50), "frequency" character varying(20) NOT NULL, "interval" integer NOT NULL DEFAULT '1', "startDate" date NOT NULL, "endDate" date, "occurrences" integer, "isActive" boolean NOT NULL DEFAULT true, "nextDueDate" date, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "userId" integer NOT NULL, "subcategoryId" integer NOT NULL, CONSTRAINT "PK_385d642719c722d2e1a23d76e90" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "installment_transactions" ("id" SERIAL NOT NULL, "totalAmount" numeric(10,2) NOT NULL, "numberOfInstallments" integer NOT NULL, "installmentAmount" numeric(10,2) NOT NULL, "description" text, "paymentMethod" character varying(50), "firstPaymentDate" date NOT NULL, "isCompleted" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "userId" integer NOT NULL, "subcategoryId" integer NOT NULL, CONSTRAINT "PK_b3761d8daa307ac2692d509b604" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "incomes" DROP COLUMN "source"`);
        await queryRunner.query(`ALTER TABLE "expenses" ADD "expenseType" character varying(30) NOT NULL DEFAULT 'single'`);
        await queryRunner.query(`ALTER TABLE "expenses" ADD "parentId" integer`);
        await queryRunner.query(`ALTER TABLE "expenses" ADD "isProcessed" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "incomes" ADD "categoryId" integer`);
        await queryRunner.query(`ALTER TABLE "incomes" DROP COLUMN "description"`);
        await queryRunner.query(`ALTER TABLE "incomes" ADD "description" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "incomes" ADD CONSTRAINT "FK_fbef3dc1374cddde596333d66f0" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "recurring_expense_definitions" ADD CONSTRAINT "FK_482fb5c8878671307f3a331c926" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "recurring_expense_definitions" ADD CONSTRAINT "FK_2b04578f9059ae7342a5b0fdbaf" FOREIGN KEY ("subcategoryId") REFERENCES "subcategories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "installment_transactions" ADD CONSTRAINT "FK_10fef1ba182680b15fd353b4007" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "installment_transactions" ADD CONSTRAINT "FK_84386720e685c27bf9368bf6199" FOREIGN KEY ("subcategoryId") REFERENCES "subcategories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "installment_transactions" DROP CONSTRAINT "FK_84386720e685c27bf9368bf6199"`);
        await queryRunner.query(`ALTER TABLE "installment_transactions" DROP CONSTRAINT "FK_10fef1ba182680b15fd353b4007"`);
        await queryRunner.query(`ALTER TABLE "recurring_expense_definitions" DROP CONSTRAINT "FK_2b04578f9059ae7342a5b0fdbaf"`);
        await queryRunner.query(`ALTER TABLE "recurring_expense_definitions" DROP CONSTRAINT "FK_482fb5c8878671307f3a331c926"`);
        await queryRunner.query(`ALTER TABLE "incomes" DROP CONSTRAINT "FK_fbef3dc1374cddde596333d66f0"`);
        await queryRunner.query(`ALTER TABLE "incomes" DROP COLUMN "description"`);
        await queryRunner.query(`ALTER TABLE "incomes" ADD "description" text`);
        await queryRunner.query(`ALTER TABLE "incomes" DROP COLUMN "categoryId"`);
        await queryRunner.query(`ALTER TABLE "expenses" DROP COLUMN "isProcessed"`);
        await queryRunner.query(`ALTER TABLE "expenses" DROP COLUMN "parentId"`);
        await queryRunner.query(`ALTER TABLE "expenses" DROP COLUMN "expenseType"`);
        await queryRunner.query(`ALTER TABLE "incomes" ADD "source" character varying(100)`);
        await queryRunner.query(`DROP TABLE "installment_transactions"`);
        await queryRunner.query(`DROP TABLE "recurring_expense_definitions"`);
    }

}
