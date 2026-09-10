import {
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Column,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

@Entity({
  name: 'footer',
})
export class FooterEntity extends EntityRelationalHelper {
  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  /** Column heading, default (English) — also the grouping key (#088). */
  @Column({
    nullable: true,
    type: String,
  })
  categories?: string | null;

  /** Column heading in Vietnamese; falls back to `categories`. */
  @Column({
    nullable: true,
    type: String,
  })
  categoriesVi?: string | null;

  @Column({
    nullable: false,
    type: String,
  })
  url: string;

  @Column({
    nullable: false,
    type: String,
  })
  title: string;

  @Column({
    nullable: false,
    type: String,
  })
  titleVi: string;

  @Column({
    nullable: true,
    type: String,
  })
  iconUrl?: string | null;

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
