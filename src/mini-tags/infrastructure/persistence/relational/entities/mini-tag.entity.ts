import {
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Column,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

@Entity({
  name: 'mini_tag',
})
export class MiniTagEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    nullable: true,
    type: String,
  })
  image?: string | null;

  @Column({
    nullable: false,
    type: String,
  })
  title: string;

  @Column({
    nullable: true,
    type: String,
  })
  description?: string | null;

  @Column({
    nullable: true,
    type: String,
  })
  contentButton?: string | null;

  @Column({
    nullable: true,
    type: String,
  })
  linkUrl?: string | null;

  // English copy for English blog posts; each falls back to the field above (#059).
  @Column({ nullable: true, type: String })
  titleEn?: string | null;

  @Column({ nullable: true, type: String })
  descriptionEn?: string | null;

  @Column({ nullable: true, type: String })
  contentButtonEn?: string | null;

  @Column({ nullable: true, type: String })
  linkUrlEn?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
