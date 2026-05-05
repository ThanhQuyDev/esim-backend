import { FileEntity } from '../../../../../files/infrastructure/persistence/relational/entities/file.entity';

import {
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  JoinColumn,
  OneToOne,
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

  @OneToOne(() => FileEntity, { eager: true, nullable: true })
  @JoinColumn()
  icon?: FileEntity | null;

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
