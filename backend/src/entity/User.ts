// backend/src/entity/User.ts (Correct Standard Pattern)
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne, // Import OneToOne
  DeleteDateColumn // <-- ADDED
} from 'typeorm';
import { Income } from './Income';
import { Expense } from './Expense';
import { UserSettings } from './UserSettings'; // Import UserSettings
import { BudgetProfile } from './BudgetProfile'; // Add this
import { Budget } from './Budget';     

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('increment')
  id!: number; // Property 'id'

  @Column({ type: 'varchar', length: 255, unique: true, nullable: false })
  email!: string; // Property 'email'

  @Column({ type: 'varchar', length: 255, nullable: false, select: false })
  password!: string; // Property 'password'

  @Column({ type: 'varchar', length: 100, nullable: true })
  name?: string; // Property 'name'

  // --- OneToMany Relations (Keep using string names for now) ---
  @OneToMany('Income', (income: Income) => income.user)
  incomes!: Income[];

  @OneToMany('Expense', (expense: Expense) => expense.user)
  expenses!: Expense[];

  // --- OneToOne Relation (Inverse Side) ---
  @OneToOne(
    () => UserSettings, // Use arrow function pointing to imported UserSettings class
    (settings: UserSettings) => settings.user, // Point back to the 'user' property on UserSettings
    { cascade: true }
  )
  
  @OneToMany(() => BudgetProfile, (profile) => profile.user)
  budgetProfiles!: BudgetProfile[];

  @OneToMany(() => Budget, (budget) => budget.user) // Direct budgets linked to user
  budgets!: Budget[];
  
  // NO @JoinColumn decorator on the inverse side
  settings!: UserSettings; // Property 'settings'

  // --- Timestamps ---
  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
  
  @DeleteDateColumn() // <-- ADDED
  deletedAt?: Date;   // Can be nullable
}