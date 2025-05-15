import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserToCategory1747328457275 implements MigrationInterface {
    name = 'AddUserToCategory1747328457275'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "budgets" ("id" SERIAL NOT NULL, "year" integer NOT NULL, "month" integer NOT NULL, "allocatedAmount" numeric(10,2) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" integer NOT NULL, "subcategoryId" integer NOT NULL, CONSTRAINT "UQ_9d5dbf6a0437be47652524a7178" UNIQUE ("userId", "subcategoryId", "year", "month"), CONSTRAINT "PK_9c8a51748f82387644b773da482" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "categories" ADD "userId" integer`);
        await queryRunner.query(`ALTER TABLE "categories" ADD CONSTRAINT "FK_13e8b2a21988bec6fdcbb1fa741" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "budgets" ADD CONSTRAINT "FK_27e688ddf1ff3893b43065899f9" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "budgets" ADD CONSTRAINT "FK_7a5c24504172445945d54daf636" FOREIGN KEY ("subcategoryId") REFERENCES "subcategories"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "budgets" DROP CONSTRAINT "FK_7a5c24504172445945d54daf636"`);
        await queryRunner.query(`ALTER TABLE "budgets" DROP CONSTRAINT "FK_27e688ddf1ff3893b43065899f9"`);
        await queryRunner.query(`ALTER TABLE "categories" DROP CONSTRAINT "FK_13e8b2a21988bec6fdcbb1fa741"`);
        await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "userId"`);
        await queryRunner.query(`DROP TABLE "budgets"`);
    }

}
