    // backend/src/entity/UserSettings.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './User.js';

@Entity('user_settings')
export class UserSettings {
  @PrimaryGeneratedColumn('increment')
  id: number;

  // Relationship: One UserSettings belongs to one User
  @OneToOne(() => User, (user) => user.settings, {
    nullable: false,
    onDelete: 'CASCADE', // If user deleted, delete their settings
  })
  @JoinColumn({ name: 'userId' }) // Creates a unique foreign key 'userId'
  user: User;

  // Enforce OneToOne uniqueness at DB level as well
  @Column({ type: 'int', unique: true, nullable: false })
  userId: number;

  @Column({ type: 'varchar', length: 3, default: 'ILS', nullable: false })
  defaultCurrency: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  monthlyBudgetGoal?: number;

  // Add other settings fields here later

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}