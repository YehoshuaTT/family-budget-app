// backend/src/entity/UserSettings.ts (Correct Standard Pattern)
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne, // Import OneToOne
  JoinColumn // Import JoinColumn
} from 'typeorm';
import { User } from './User'; // Need to import User for relation definition

@Entity('user_settings')
export class UserSettings {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  // The foreign key column MUST exist
  @Column({ type: 'int', unique: true, nullable: false })
  userId!: number;

  // Define the owning side of the relation AND specify the FK column
  @OneToOne(
    () => User, // Use arrow function pointing to the imported User class
    (user: User) => user.settings, // Point to the 'settings' property on the User entity
    { onDelete: 'CASCADE' } // Added onDelete for consistency
  )
  @JoinColumn({ name: 'userId' }) // Specifies that 'userId' in THIS table is the FK
  user!: User; // Important: Add the property to hold the related User object

  // Other columns
  @Column({ type: 'varchar', length: 3, default: 'ILS', nullable: false })
  defaultCurrency!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  monthlyBudgetGoal?: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}