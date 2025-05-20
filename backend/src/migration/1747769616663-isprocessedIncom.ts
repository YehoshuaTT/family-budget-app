import { MigrationInterface, QueryRunner } from "typeorm";

export class IsprocessedIncom1747769616663 implements MigrationInterface {
    name = 'IsprocessedIncom1747769616663'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "incomes" ADD "isProcessed" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "incomes" DROP COLUMN "isProcessed"`);
    }

}
