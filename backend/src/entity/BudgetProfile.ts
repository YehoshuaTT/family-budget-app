// backend/src/entity/BudgetProfile.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn, // Added for soft delete capability
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from './User';
import { Budget } from './Budget';

@Entity('budget_profiles')
export class BudgetProfile {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'varchar', length: 100, nullable: false })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'date', nullable: true })
  startDate?: string | null; // Format YYYY-MM-DD

  @Column({ type: 'date', nullable: true })
  endDate?: string | null; // Format YYYY-MM-DD

  @Column({ type: 'boolean', default: false, nullable: false })
  isActive!: boolean; // Only one profile should be active per user at a time (handled by application logic)

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn() // For soft-deleting the profile itself
  deletedAt?: Date;

  // --- Relationships ---
  @Column({ type: 'int', nullable: false })
  userId!: number;

  @ManyToOne(() => User, (user) => user.budgetProfiles, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  // A budget profile has many monthly budget allocations for subcategories
  @OneToMany(() => Budget, (budget) => budget.budgetProfile, { cascade: ['insert', 'update', 'soft-remove', 'recover'] })
  budgetAllocations!: Budget[];
}