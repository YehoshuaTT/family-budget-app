import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSoftDeleteColumns1747081770204 implements MigrationInterface {
    name = 'AddSoftDeleteColumns1747081770204'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "deletedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "expenses" ADD "deletedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "subcategories" ADD "archived" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "categories" ADD "type" character varying(20) NOT NULL DEFAULT 'expense'`);
        await queryRunner.query(`ALTER TABLE "categories" ADD "archived" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "incomes" ADD "deletedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "categories" DROP CONSTRAINT "UQ_8b0be371d28245da6e4f4b61878"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "categories" ADD CONSTRAINT "UQ_8b0be371d28245da6e4f4b61878" UNIQUE ("name")`);
        await queryRunner.query(`ALTER TABLE "incomes" DROP COLUMN "deletedAt"`);
        await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "archived"`);
        await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "type"`);
        await queryRunner.query(`ALTER TABLE "subcategories" DROP COLUMN "archived"`);
        await queryRunner.query(`ALTER TABLE "expenses" DROP COLUMN "deletedAt"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "deletedAt"`);
    }

}
