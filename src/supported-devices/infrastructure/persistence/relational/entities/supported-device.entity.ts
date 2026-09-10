import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { DeviceType } from '../../../../domain/supported-device';

@Entity({ name: 'supported_device' })
export class SupportedDeviceEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false, type: String })
  device: string;

  @Column({ nullable: false, type: String })
  manufacturer: string;

  @Column({ nullable: false, type: 'enum', enum: DeviceType })
  type: DeviceType;

  /** Where this device's BRAND sits in the list; 0 = alphabetical (#090). */
  @Column({ type: 'int', default: 0 })
  manufacturerOrder: number;

  /** Where this model sits inside its brand; 0 = alphabetical (#090). */
  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
