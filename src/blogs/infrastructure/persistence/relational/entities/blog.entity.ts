import {
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Column,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

@Entity({
  name: 'blog',
})
export class BlogEntity extends EntityRelationalHelper {
  @Column({
    nullable: false,
    type: String,
  })
  language: string;

  @Column({
    nullable: true,
    type: Date,
  })
  publishedAt?: Date | null;

  @Column({
    nullable: false,
    type: Boolean,
  })
  isPublished?: boolean;

  @Column({
    nullable: true,
    type: String,
  })
  author?: string | null;

  @Column({
    nullable: true,
    type: String,
  })
  tags?: string | null;

  @Column({
    nullable: true,
    type: String,
  })
  coverImage?: string | null;

  @Column({
    nullable: true,
    type: String,
  })
  excerpt?: string | null;

  @Column({
    nullable: false,
    type: String,
  })
  content: string;

  @Column({
    nullable: false,
    type: String,
  })
  slug: string;

  @Column({
    nullable: false,
    type: String,
  })
  title: string;

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
