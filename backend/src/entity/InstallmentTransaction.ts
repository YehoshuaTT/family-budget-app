// backend/src/entity/InstallmentTransaction.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  // OneToMany // Uncomment if you add 'payments' property below
} from 'typeorm';
import { User } from './User';
import { Subcategory } from './Subcategory';
// import { Expense } from './Expense'; // Uncomment if you add 'payments' property below

@Entity('installment_transactions')
export class InstallmentTransaction {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  totalAmount!: number;

  @Column({ type: 'int', nullable: false })
  numberOfInstallments!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  installmentAmount!: number;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  paymentMethod?: string;

  @Column({ type: 'date', nullable: false })
  firstPaymentDate!: string;

  @Column({ type: 'boolean', default: false, nullable: false })
  isCompleted!: boolean;

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

  @Column({ type: 'int', nullable: false })
  subcategoryId!: number;

  @ManyToOne(() => Subcategory, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'subcategoryId' })
  subcategory!: Subcategory;

  // Optional: If you want a direct TypeORM relation to generated payments
  // @OneToMany(() => Expense, (expense) => expense.installmentTransaction) // Assumes 'installmentTransaction' property exists in Expense
  // payments!: Expense[];
}