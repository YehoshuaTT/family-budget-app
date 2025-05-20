// backend/src/entity/RecurringIncomeDefinition.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  // OneToMany, // אם תרצה לקשר מופעי Income שנוצרו אוטומטית
} from 'typeorm';
import { User } from './User';
import { Category } from './Category'; // הכנסות נקשרות ישירות לקטגוריה (מסוג 'income')
// import { Income } from './Income'; // אם יהיה קשר למופעים

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'bi-monthly' | 'quarterly' | 'semi-annually' | 'annually';

@Entity('recurring_income_definitions')
export class RecurringIncomeDefinition {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  amount!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description?: string;

  @Column({
    type: 'varchar',
    length: 20,
    enum: ['daily', 'weekly', 'monthly', 'bi-monthly', 'quarterly', 'semi-annually', 'annually'],
    nullable: false,
  })
  frequency!: Frequency;

  @Column({ type: 'int', default: 1, nullable: false }) // e.g., every 1 month, every 2 weeks
  interval!: number;

  @Column({ type: 'date', nullable: false })
  startDate!: string; // YYYY-MM-DD

  @Column({ type: 'date', nullable: true })
  endDate?: string | null; // YYYY-MM-DD

  @Column({ type: 'int', nullable: true })
  occurrences?: number | null; // Number of times this should repeat

  @Column({ type: 'boolean', default: true, nullable: false })
  isActive!: boolean; // To easily pause/resume

  @Column({ type: 'date', nullable: true }) // For scheduler to know when to create next instance
  nextDueDate?: string | null; // YYYY-MM-DD

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

  @Column({ type: 'int', nullable: false }) // הכנסות נקשרות לקטגוריה
  categoryId!: number;

  @ManyToOne(() => Category, { nullable: false, onDelete: 'RESTRICT' }) // ודא שהקטגוריה היא מסוג 'income'
  @JoinColumn({ name: 'categoryId' })
  category!: Category;

  // אופציונלי: קשר למופעי הכנסה שנוצרו מהגדרה זו
  // @OneToMany(() => Income, income => income.recurringIncomeDefinition) // תצטרך להוסיף שדה recurringIncomeDefinitionId ל-Income entity
  // instances!: Income[];
}