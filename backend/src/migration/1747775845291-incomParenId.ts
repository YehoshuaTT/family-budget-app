import { MigrationInterface, QueryRunner } from "typeorm";

export class IncomParenId1747775845291 implements MigrationInterface {
    name = 'IncomParenId1747775845291'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "incomes" ADD "parentId" integer`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "incomes" DROP COLUMN "parentId"`);
    }

}
