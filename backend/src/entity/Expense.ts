// backend/src/entity/Expense.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { User } from './User.js';
import { Subcategory } from './Subcategory.js';

@Entity('expenses')
export class Expense {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  amount: number;

  @Column({ type: 'date', nullable: false })
  date: string; // Or Date object

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  paymentMethod?: string;

  // Relationship: Many Expenses belong to one User
  @ManyToOne(() => User, (user) => user.expenses, {
    nullable: false,
    onDelete: 'CASCADE', // If user deleted, delete their expenses
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'int', nullable: false })
  userId: number;

  // Relationship: Many Expenses belong to one Subcategory
  @ManyToOne(() => Subcategory, (subcategory) => subcategory.expenses, {
    nullable: false, // An expense must have a subcategory (change if needed)
    onDelete: 'RESTRICT', // Prevent deleting a subcategory if expenses are linked. Consider 'SET NULL' if you add an 'Uncategorized' option.
  })
  @JoinColumn({ name: 'subcategoryId' })
  subcategory: Subcategory;

  @Column({ type: 'int', nullable: false })
  subcategoryId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}