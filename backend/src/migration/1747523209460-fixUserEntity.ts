import { MigrationInterface, QueryRunner } from "typeorm";

export class FixUserEntity1747523209460 implements MigrationInterface {
    name = 'FixUserEntity1747523209460'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "passwordResetToken" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "users" ADD "passwordResetExpires" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "passwordResetExpires"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "passwordResetToken"`);
    }

}
