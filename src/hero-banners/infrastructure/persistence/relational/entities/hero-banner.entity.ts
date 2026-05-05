import {
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Column,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

@Entity({
  name: 'hero_banner',
})
export class HeroBannerEntity extends EntityRelationalHelper {
  @Column({
    nullable: false,
    type: Boolean,
  })
  active: boolean;

  @Column({
    nullable: false,
    type: String,
  })
  title: string;

  @Column({
    nullable: false,
    type: String,
  })
  firstIcon: string;

  @Column({
    nullable: false,
    type: String,
  })
  firstContent: string;

  @Column({
    nullable: false,
    type: String,
  })
  secondIcon: string;

  @Column({
    nullable: false,
    type: String,
  })
  secondContent: string;

  @Column({
    nullable: false,
    type: String,
  })
  description: string;

  @Column({
    nullable: false,
    type: String,
    default: 'en',
  })
  language: string;

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
