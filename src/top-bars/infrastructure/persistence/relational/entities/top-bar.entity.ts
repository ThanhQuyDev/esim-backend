import {
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Column,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

@Entity({
  name: 'top_bar',
})
export class TopBarEntity extends EntityRelationalHelper {
  @Column({
    nullable: false,
    type: String,
  })
  url: string;

  @Column({
    nullable: false,
    type: String,
  })
  buttonContent: string;

  @Column({
    nullable: false,
    type: String,
  })
  title: string;

  @Column({
    nullable: false,
    type: String,
    default: 'en',
  })
  language: string;

  @Column({
    nullable: true,
    type: String,
  })
  icon?: string | null;

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
