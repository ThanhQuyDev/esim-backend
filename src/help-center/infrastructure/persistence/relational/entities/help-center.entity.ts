import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

@Entity({ name: 'help_center' })
export class HelpCenterEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true, type: String })
  slug?: string | null;

  @Column({ nullable: true, type: String })
  language?: string | null;

  @Column({ nullable: false, type: String })
  title: string;

  @Column({ nullable: false, type: 'text' })
  content: string;

  @Column({ nullable: false, type: 'integer', default: 0 })
  order: number;

  @Column({ nullable: false, type: String })
  category: string;

  @Column({ nullable: false, type: String })
  parent: string;

  @Column({ nullable: false, type: Boolean, default: false })
  isPopular: boolean;

  @Column({ nullable: false, type: Boolean, default: true })
  isPublished: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
