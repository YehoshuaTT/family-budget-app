// backend/src/entity/Income.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  DeleteDateColumn,

} from 'typeorm';
import { User } from './User'; // Static import

@Entity('incomes')
export class Income {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  amount!: number;

  @Column({ type: 'date', nullable: false })
  date!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  source?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  // Relationship using String Name
  @ManyToOne(
    'User', // Use string name
    (user: User) => user.incomes, // Keep arrow function for inverse side, add type
    { nullable: false, onDelete: 'CASCADE' }
  )
  @JoinColumn({ name: 'userId' })
  user!: User; // Type remains the same

  @Column({ type: 'int', nullable: false })
  userId!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}