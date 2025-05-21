// backend/src/entity/Income.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './User';
import { Category } from './Category';

@Entity('incomes')
export class Income {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  amount!: number;

  @Column({ type: 'date', nullable: false })
  date!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt?: Date;

  // --- Relationships ---
  @Column({ type: 'int', nullable: false })
  userId!: number;

  @ManyToOne(() => User, (user) => user.incomes, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'int', nullable: true })
  categoryId?: number | null;

  @Column({ type: 'boolean', default: false, nullable: false })
isProcessed!: boolean;

  @Column({ type: 'integer', nullable: true }) // FK to either RecurringExpenseDefinition or InstallmentTransaction
  parentId?: number | null;

  @ManyToOne(() => Category, (category) => category.incomes, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'categoryId' })
  category?: Category | null;
}