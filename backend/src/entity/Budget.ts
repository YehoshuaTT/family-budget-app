// backend/src/entity/Budget.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique, // To ensure only one budget entry per user/subcategory/month/year
} from 'typeorm';
import { User } from './User';
import { Subcategory } from './Subcategory'; // Budgeting will be at the subcategory level

@Entity('budgets')
@Unique(["userId", "subcategoryId", "year", "month"]) // Ensures one budget entry per user, subcategory, for a specific month and year
export class Budget {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'int', nullable: false })
  year!: number; // e.g., 2024

  @Column({ type: 'int', nullable: false }) // 1 for January, 12 for December
  month!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  allocatedAmount!: number; // The amount budgeted for this subcategory for this month/year

  // Optional: could add 'spentAmount' here and update it via triggers or batch jobs,
  // but for now, we'll calculate spent amount dynamically via queries on Expenses.

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // --- Relationships ---
  @Column({ type: 'int', nullable: false })
  userId!: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'int', nullable: false })
  subcategoryId!: number;

  @ManyToOne(() => Subcategory, { nullable: false, onDelete: 'CASCADE' }) // If subcategory is deleted, budget for it is also deleted
  @JoinColumn({ name: 'subcategoryId' })
  subcategory!: Subcategory;
}