import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';
import { WalletStatusEnum } from '../../../../wallets.enum';

@Entity({ name: 'user_wallet' })
export class UserWalletEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: Number, unique: true })
  userId!: number;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'userId' })
  user?: UserEntity;

  @Column({ type: 'decimal', precision: 14, scale: 0, default: 0 })
  balanceVnd!: number;

  @Index()
  @Column({ type: String, default: WalletStatusEnum.ACTIVE })
  status!: WalletStatusEnum;

  @Index()
  @Column({ type: 'timestamp', nullable: true })
  expiresAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
