// backend/src/entity/Subcategory.ts
import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  OneToMany, CreateDateColumn, UpdateDateColumn, JoinColumn,
} from 'typeorm';
import { Category } from './Category'; // CJS: No .js
import { Expense } from './Expense';   // CJS: No .js
import { Budget } from './Budget'; // Add this


@Entity('subcategories')
export class Subcategory {
  @PrimaryGeneratedColumn('increment')
  id!: number;
  
  @Column({ type: 'varchar', length: 100, nullable: false })
  name!: string;
  
  @Column({ type: 'boolean', default: false, nullable: false})
  archived!: boolean; // <-- ADDED
  
  @Column({ type: 'int', nullable: false })
  categoryId!: number; // FK Column
  
  @ManyToOne(
    () => Category,
    (category: Category) => category.subcategories,
    { nullable: false, onDelete: 'CASCADE' }
  )
  @JoinColumn({ name: 'categoryId' }) // Owning side
  category!: Category;
  
  @OneToMany(() => Budget, (budget) => budget.subcategory)
  budgets!: Budget[];

  @OneToMany(
     () => Expense,
     (expense: Expense) => expense.subcategory
  )
  expenses!: Expense[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}