// backend/src/entity/Subcategory.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn, // Import JoinColumn
} from 'typeorm';
import { Category } from './Category.js';
import { Expense } from './Expense.js'; // We'll define Expense next

@Entity('subcategories')
export class Subcategory {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'varchar', length: 100, nullable: false })
  name: string;

  // Relationship: Many Subcategories belong to one Category
  @ManyToOne(() => Category, (category) => category.subcategories, {
    nullable: false, // A subcategory must belong to a category
    onDelete: 'CASCADE', // If a category is deleted, delete its subcategories
  })
  @JoinColumn({ name: 'categoryId' }) // Explicit foreign key column name
  category: Category;

  // Explicitly define the foreign key column (optional but good practice)
  @Column({ type: 'int', nullable: false })
  categoryId: number;

  // Relationship: One Subcategory can have many Expenses
  @OneToMany(() => Expense, (expense) => expense.subcategory)
  expenses: Expense[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}