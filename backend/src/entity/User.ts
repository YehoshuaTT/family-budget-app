// backend/src/entity/User.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany, // Import OneToMany
  OneToOne, // Import OneToOne
} from 'typeorm';
import { Income } from './Income.js'; // Import Income
import { Expense } from './Expense.js'; // Import Expense
import { UserSettings } from './UserSettings.js'; // Import UserSettings

@Entity('users') // Ensure table name is specified
export class User {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: false })
  email: string;

  // Good practice: don't select password by default
  @Column({ type: 'varchar', length: 255, nullable: false, select: false })
  password: string;

  // Optional name from signup
  @Column({ type: 'varchar', length: 100, nullable: true })
  name?: string;

  // --- New Relationships ---

  // Relationship: One User has many Incomes
  @OneToMany(() => Income, (income) => income.user)
  incomes: Income[];

  // Relationship: One User has many Expenses
  @OneToMany(() => Expense, (expense) => expense.user)
  expenses: Expense[];

  // Relationship: One User has one UserSettings
  // cascade: true can help automatically save/update settings when saving the user
  @OneToOne(() => UserSettings, (settings) => settings.user, { cascade: true })
  settings: UserSettings;

  // --- Timestamps ---
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}