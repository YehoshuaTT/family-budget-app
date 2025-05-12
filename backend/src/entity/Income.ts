// backend/src/entity/Income.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { User } from './User.js';

@Entity('incomes')
export class Income {
  @PrimaryGeneratedColumn('increment')
  id: number;

  // Using 'decimal' for financial values is recommended over float/double
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  amount: number;

  @Column({ type: 'date', nullable: false }) // Store only the date part
  date: string; // TypeORM maps JS Date objects correctly, storing as string is also viable

  // Optional fields marked with '?' in TS and nullable: true in TypeORM
  @Column({ type: 'varchar', length: 100, nullable: true })
  source?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  // Relationship: Many Incomes belong to one User
  @ManyToOne(() => User, (user) => user.incomes, {
    nullable: false, // An income must belong to a user
    onDelete: 'CASCADE', // If a user is deleted, delete their incomes
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'int', nullable: false })
  userId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}