import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateRecurringIncomeDefinitionsTable21747605943554 implements MigrationInterface {
    name = 'CreateRecurringIncomeDefinitionsTable21747605943554'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "recurring_income_definitions" ("id" SERIAL NOT NULL, "amount" numeric(10,2) NOT NULL, "description" character varying(255), "frequency" character varying(20) NOT NULL, "interval" integer NOT NULL DEFAULT '1', "startDate" date NOT NULL, "endDate" date, "occurrences" integer, "isActive" boolean NOT NULL DEFAULT true, "nextDueDate" date, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "userId" integer NOT NULL, "categoryId" integer NOT NULL, CONSTRAINT "PK_be59f8cb6397b4daaff73138567" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "recurring_income_definitions" ADD CONSTRAINT "FK_3deb4d6ec6908832ec45118bd76" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "recurring_income_definitions" ADD CONSTRAINT "FK_c09962c78795e74291118ce482c" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "recurring_income_definitions" DROP CONSTRAINT "FK_c09962c78795e74291118ce482c"`);
        await queryRunner.query(`ALTER TABLE "recurring_income_definitions" DROP CONSTRAINT "FK_3deb4d6ec6908832ec45118bd76"`);
        await queryRunner.query(`DROP TABLE "recurring_income_definitions"`);
    }

}
