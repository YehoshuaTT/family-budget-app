// backend/src/entity/RecurringExpenseDefinition.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  // OneToMany // Uncomment if you add 'instances' property below
} from 'typeorm';
import { User } from './User';
import { Subcategory } from './Subcategory';
// import { Expense } from './Expense'; // Uncomment if you add 'instances' property below

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'bi-monthly' | 'quarterly' | 'semi-annually' | 'annually';

@Entity('recurring_expense_definitions')
export class RecurringExpenseDefinition {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  amount!: number;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  paymentMethod?: string;

  @Column({ type: 'varchar', length: 20, nullable: false })
  frequency!: Frequency;

  @Column({ type: 'int', default: 1, nullable: false })
  interval!: number;

  @Column({ type: 'date', nullable: false })
  startDate!: string;

  @Column({ type: 'date', nullable: true })
  endDate?: string | null;

  @Column({ type: 'int', nullable: true })
  occurrences?: number | null;

  @Column({ type: 'boolean', default: true, nullable: false })
  isActive!: boolean;

  @Column({ type: 'date', nullable: true })
  nextDueDate?: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt?: Date;

  // --- Relationships ---
  @Column({ type: 'int', nullable: false })
  userId!: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'int', nullable: false })
  subcategoryId!: number;

  @ManyToOne(() => Subcategory, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'subcategoryId' })
  subcategory!: Subcategory;

  // Optional: If you want a direct TypeORM relation to generated expenses
  // @OneToMany(() => Expense, (expense) => expense.recurringDefinition) // Assumes 'recurringDefinition' property exists in Expense
  // instances!: Expense[];
}