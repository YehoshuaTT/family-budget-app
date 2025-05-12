// backend/src/entity/Category.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Subcategory } from './Subcategory.js'; // Note the .js extension

@Entity('categories') // Explicitly naming the table 'categories'
export class Category {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'varchar', length: 100, unique: true, nullable: false })
  name!: string;

  // A category can have multiple subcategories
  @OneToMany(() => Subcategory, (subcategory) => subcategory.category)
  subcategories!: Subcategory[];

  // Optional: Keep track of when records are created/updated
  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}