// backend/src/entity/Expense.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  DeleteDateColumn ,
} from 'typeorm';
import { User } from './User'; // Static import
import { Subcategory } from './Subcategory'; // Static import

@Entity('expenses')
export class Expense {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  amount!: number;

  @Column({ type: 'date', nullable: false })
  date!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  paymentMethod?: string;

  // Relationship using String Name
  @ManyToOne(
    'User', // Use string name
    (user: User) => user.expenses, // Keep arrow function for inverse side, add type
    { nullable: false, onDelete: 'CASCADE' }
  )
  @JoinColumn({ name: 'userId' })
  user!: User; // Type remains the same

  @Column({ type: 'int', nullable: false })
  userId!: number;

  // Relationship using String Name
  @ManyToOne(
    'Subcategory', // Use string name
    (subcategory: Subcategory) => subcategory.expenses, // Keep arrow function for inverse side, add type
    { nullable: false, onDelete: 'RESTRICT' }
  )
  @JoinColumn({ name: 'subcategoryId' })
  subcategory!: Subcategory; // Type remains the same

  @Column({ type: 'int', nullable: false })
  subcategoryId!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}