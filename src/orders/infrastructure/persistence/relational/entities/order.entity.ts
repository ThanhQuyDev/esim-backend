import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

@Entity({
  name: 'order',
})
export class OrderEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: Number })
  userId: number;

  @ManyToOne(() => UserEntity, {
    eager: true,
  })
  @JoinColumn({ name: 'userId' })
  user?: UserEntity;

  @Index()
  @Column({ type: String, unique: true })
  orderNumber: string;

  @Index()
  @Column({ type: String, default: 'pending' })
  status: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ type: String, length: 3 })
  currency: string;

  @Column({ type: String, nullable: true })
  paymentMethod?: string | null;

  @Column({ type: String, nullable: true })
  paymentId?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
