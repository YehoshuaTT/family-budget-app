// backend/src/entity/Category.ts
import {
  Entity,  PrimaryGeneratedColumn, Column,
  OneToMany, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Subcategory } from './Subcategory'; // CJS: No .js

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'varchar', length: 100, nullable: false })
  name!: string;
  
  @Column({ type: 'varchar', length: 20, default: 'expense', nullable: false}) // 'expense' or 'income'
  type!: string;
  
  @Column({ type: 'boolean', default: false, nullable: false})
  archived!: boolean; // <-- ADDED

  @OneToMany(
    () => Subcategory,
    (subcategory: Subcategory) => subcategory.category
  )
  subcategories!: Subcategory[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}