import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import {
  HelpCenterCategory,
  HelpCenterParent,
} from '../../../../domain/help-center';

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

  @Column({ nullable: false, type: 'enum', enum: HelpCenterCategory })
  category: HelpCenterCategory;

  @Column({ nullable: false, type: 'enum', enum: HelpCenterParent })
  parent: HelpCenterParent;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
