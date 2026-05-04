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
  name: 'hero_banner',
})
export class HeroBannerEntity extends EntityRelationalHelper {
  @Column({
    nullable: false,
    type: Boolean,
  })
  active: boolean;

  @OneToOne(() => FileEntity, { eager: true, nullable: true })
  @JoinColumn()
  image?: FileEntity | null;

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
