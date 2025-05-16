// backend/src/entity/Budget.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn, // Added for soft delete capability
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from './User';
import { Subcategory } from './Subcategory';
import { BudgetProfile } from './BudgetProfile';

@Entity('budgets')
@Unique(["budgetProfileId", "subcategoryId", "year", "month"])
export class Budget {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'int', nullable: false })
  year!: number; // e.g., 2024

  @Column({ type: 'int', nullable: false }) // 1 for January, 12 for December
  month!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  allocatedAmount!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt?: Date;

  // --- Relationships ---
  @Column({ type: 'int', nullable: false })
  userId!: number; // Kept for easier querying directly on budgets per user

  @ManyToOne(() => User, (user) => user.budgets, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'int', nullable: false })
  subcategoryId!: number;

  @ManyToOne(() => Subcategory, (subcategory) => subcategory.budgets, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subcategoryId' })
  subcategory!: Subcategory;

  @Column({ type: 'int', nullable: false })
  budgetProfileId!: number;

  @ManyToOne(() => BudgetProfile, (profile) => profile.budgetAllocations, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'budgetProfileId' })
  budgetProfile!: BudgetProfile;
}