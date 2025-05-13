// backend/src/entity/Expense.ts
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
import { Subcategory } from './Subcategory';
// Import definitions if you decide to have direct TypeORM relations (optional for now)
// import { RecurringExpenseDefinition } from './RecurringExpenseDefinition';
// import { InstallmentTransaction } from './InstallmentTransaction';

export type ExpenseType = 'single' | 'recurring_instance' | 'installment_instance';

@Entity('expenses')
export class Expense {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  amount!: number;

  @Column({ type: 'date', nullable: false })
  date!: string; // Date the expense occurred or is due

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  paymentMethod?: string;

  @Column({ type: 'varchar', length: 30, default: 'single', nullable: false })
  expenseType!: ExpenseType;

  @Column({ type: 'integer', nullable: true }) // FK to either RecurringExpenseDefinition or InstallmentTransaction
  parentId?: number | null;

  @Column({ type: 'boolean', default: false, nullable: false }) // True if this instance has been "processed" or "occurred"
  isProcessed!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt?: Date;

  // --- Relationships ---
  @Column({ type: 'int', nullable: false })
  userId!: number;

  @ManyToOne(() => User, (user) => user.expenses, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'int', nullable: false })
  subcategoryId!: number;

  @ManyToOne(() => Subcategory, (subcategory) => subcategory.expenses, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'subcategoryId' })
  subcategory!: Subcategory;

  // Optional: If you want direct TypeORM relations to parent definitions (more complex)
  // @ManyToOne(() => RecurringExpenseDefinition, def => def.instances, { nullable: true, createForeignKeyConstraints: false })
  // @JoinColumn({ name: 'parentId', referencedColumnName: 'id' }) // This would only work if parentId always points to RecurringExpenseDefinition
  // recurringDefinition?: RecurringExpenseDefinition;

  // @ManyToOne(() => InstallmentTransaction, def => def.payments, { nullable: true, createForeignKeyConstraints: false })
  // @JoinColumn({ name: 'parentId', referencedColumnName: 'id' }) // This would only work if parentId always points to InstallmentTransaction
  // installmentTransaction?: InstallmentTransaction;
}