// backend/src/entity/Category.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Subcategory } from './Subcategory';
import { Income } from './Income';
import { User } from './User'; // Assuming you have a User entity
@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'varchar', length: 100, nullable: false }) // Consider adding unique:true if names must be unique per type
  name!: string;

  @Column({ type: 'varchar', length: 20, default: 'expense', nullable: false })
  type!: 'expense' | 'income';

  @Column({ type: 'boolean', default: false, nullable: false })
  archived!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // --- Relationships ---
  @OneToMany(() => Subcategory, (subcategory) => subcategory.category)
  subcategories!: Subcategory[];

  @OneToMany(() => Income, (income) => income.category)
  incomes!: Income[];

  @Column({ type: 'int', nullable: true }) // nullable: true אם קטגוריות יכולות להיות גם גלובליות (ללא userId)
userId?: number | null;

@ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' }) // קשר למשתמש
@JoinColumn({ name: 'userId' })
user?: User | null;
}