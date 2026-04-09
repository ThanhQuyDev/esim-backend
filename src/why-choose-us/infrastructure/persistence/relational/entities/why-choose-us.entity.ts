import {
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Column,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

@Entity({
  name: 'why_choose_us',
})
export class WhyChooseUsEntity extends EntityRelationalHelper {
  @Column({
    nullable: false,
    type: String,
  })
  language: string;

  @Column({
    nullable: false,
    type: Boolean,
  })
  isActive?: boolean;

  @Column({
    nullable: false,
    type: Number,
  })
  sortOrder: number;

  @Column({
    nullable: true,
    type: String,
  })
  icon?: string | null;

  @Column({
    nullable: false,
    type: String,
  })
  description: string;

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
