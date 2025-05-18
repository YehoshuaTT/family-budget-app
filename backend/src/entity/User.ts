// backend/src/entity/User.ts (Corrected)
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne, // Import OneToOne
  DeleteDateColumn
} from 'typeorm';
import { Income } from './Income';
import { Expense } from './Expense';
import { UserSettings } from './UserSettings';
import { BudgetProfile } from './BudgetProfile';
import { Budget } from './Budget';     

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: false })
  email!: string;

  @Column({ type: 'varchar', length: 255, nullable: false, select: false })
  password!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  name?: string;

  // --- OneToMany Relations ---
  @OneToMany(() => Income, (income: Income) => income.user) // Changed 'Income' to () => Income
  incomes!: Income[];

  @OneToMany(() => Expense, (expense: Expense) => expense.user) // Changed 'Expense' to () => Expense
  expenses!: Expense[];

  @OneToMany(() => BudgetProfile, (profile) => profile.user)
  budgetProfiles!: BudgetProfile[];

  @OneToMany(() => Budget, (budget) => budget.user)
  budgets!: Budget[];

  // --- OneToOne Relation (Inverse Side) ---
  @OneToOne( // <<--- ה-Decorator הזה צריך להיות מעל 'settings'
    () => UserSettings,
    (settings: UserSettings) => settings.user,
    { cascade: true }
  )
  settings!: UserSettings; // <<--- עכשיו ה-Decorator מעל השדה הנכון

  // --- Password Reset Fields ---
  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  passwordResetToken?: string | null;
  
  @Column({ type: 'timestamp with time zone', nullable: true, select: false }) // שיניתי ל-timestamp with time zone, יותר סטנדרטי
  passwordResetExpires?: Date | null;
  
  // --- Timestamps ---
  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
  
  @DeleteDateColumn()
  deletedAt?: Date;
}