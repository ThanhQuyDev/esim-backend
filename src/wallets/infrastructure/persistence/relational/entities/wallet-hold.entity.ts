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
import { OrderEntity } from '../../../../../orders/infrastructure/persistence/relational/entities/order.entity';
import { UserWalletEntity } from './user-wallet.entity';
import { WalletHoldStatusEnum } from '../../../../wallets.enum';

@Entity({ name: 'wallet_hold' })
export class WalletHoldEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: Number })
  walletId!: number;

  @ManyToOne(() => UserWalletEntity)
  @JoinColumn({ name: 'walletId' })
  wallet?: UserWalletEntity;

  @Index()
  @Column({ type: Number })
  userId!: number;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'userId' })
  user?: UserEntity;

  @Index()
  @Column({ type: Number, unique: true })
  orderId!: number;

  @ManyToOne(() => OrderEntity)
  @JoinColumn({ name: 'orderId' })
  order?: OrderEntity;

  @Column({ type: 'decimal', precision: 14, scale: 0 })
  amountVnd!: number;

  @Index()
  @Column({ type: String, default: WalletHoldStatusEnum.HELD })
  status!: WalletHoldStatusEnum;

  @Index()
  @Column({ type: 'timestamp' })
  expiresAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
