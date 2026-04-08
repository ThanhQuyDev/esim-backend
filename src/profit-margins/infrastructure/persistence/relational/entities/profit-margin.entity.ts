import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

@Entity({ name: 'profit_margin' })
export class ProfitMarginEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: String })
  name: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  percentage: number;

  @Index()
  @Column({ type: Boolean, default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
