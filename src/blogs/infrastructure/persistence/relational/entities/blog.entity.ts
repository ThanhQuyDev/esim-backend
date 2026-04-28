import {
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Column,
  ManyToMany,
  JoinTable,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { MiniTagEntity } from '../../../../../mini-tags/infrastructure/persistence/relational/entities/mini-tag.entity';
import { PlanEntity } from '../../../../../plans/infrastructure/persistence/relational/entities/plan.entity';

@Entity({
  name: 'blog',
})
export class BlogEntity extends EntityRelationalHelper {
  @Column({ nullable: false, type: String })
  language: string;

  @Column({ nullable: true, type: Date })
  publishedAt?: Date | null;

  @Column({ nullable: false, type: Boolean })
  isPublished?: boolean;

  @Column({ nullable: true, type: String })
  author?: string | null;

  @Column({ nullable: true, type: String })
  authorAvatar?: string | null;

  @Column({ nullable: true, type: String })
  category?: string | null;

  @Column({ nullable: true, type: String })
  coverImage?: string | null;

  @Column({ nullable: true, type: String })
  excerpt?: string | null;

  @Column({ nullable: false, type: String })
  content: string;

  @Column({ nullable: false, type: String })
  slug: string;

  @Column({ nullable: false, type: String })
  title: string;

  @Column({ nullable: true, type: 'int' })
  timeRead?: number | null;

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true, type: String })
  miniTagId?: string | null;

  @ManyToOne(() => MiniTagEntity, {
    eager: false,
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'miniTagId' })
  miniTag?: MiniTagEntity | null;

  @ManyToMany(() => PlanEntity, { eager: false })
  @JoinTable({ name: 'blog_plans' })
  plans?: PlanEntity[];
}
