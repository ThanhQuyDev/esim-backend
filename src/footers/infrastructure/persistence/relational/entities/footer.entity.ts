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
  @Column({
    nullable: true,
    type: String,
  })
  categories?: string | null;

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

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
