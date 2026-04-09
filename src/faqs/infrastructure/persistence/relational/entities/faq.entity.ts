import {
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Column,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

@Entity({
  name: 'faq',
})
export class FaqEntity extends EntityRelationalHelper {
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
    nullable: false,
    type: String,
  })
  answer: string;

  @Column({
    nullable: false,
    type: String,
  })
  question: string;

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
