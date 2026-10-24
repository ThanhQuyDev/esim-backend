import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { OrderItemEntity } from '../../../../../order-items/infrastructure/persistence/relational/entities/order-item.entity';
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';
import { PlanEntity } from '../../../../../plans/infrastructure/persistence/relational/entities/plan.entity';

@Entity({ name: 'esim' })
export class EsimEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: Number, nullable: true })
  orderItemId: number | null;

  @ManyToOne(() => OrderItemEntity, { nullable: true })
  @JoinColumn({ name: 'orderItemId' })
  orderItem: OrderItemEntity | null;

  @Index()
  @Column({ type: Number, nullable: true })
  userId: number | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user: UserEntity | null;

  @Index()
  @Column({ type: Number, nullable: true })
  planId: number | null;

  @ManyToOne(() => PlanEntity, { nullable: true })
  @JoinColumn({ name: 'planId' })
  plan: PlanEntity | null;

  @Column({ type: String, unique: true })
  iccid: string;

  @Column({ type: String, nullable: true })
  smdpAddress: string | null;

  @Column({ type: String, nullable: true })
  activationCode: string | null;

  @Column({ type: String, nullable: true })
  lpa: string | null;

  @Column({ type: String, nullable: true })
  matchId: string | null;

  @Column({ type: String, nullable: true })
  qrcode: string | null;

  @Column({ type: 'uuid', nullable: true, default: () => 'uuid_generate_v4()' })
  qrAccessToken: string | null;

  @Column({ type: String, nullable: true })
  directAppleInstallationUrl: string | null;

  @Column({ type: String, nullable: true })
  apnValue: string | null;

  @Column({ type: Boolean, nullable: true })
  isRoaming: boolean | null;

  @Index()
  @Column({ type: String, default: 'available' })
  status: string;

  @Column({ type: String, nullable: true })
  dataUsed: string | null;

  @Column({ type: String, nullable: true })
  dataTotal: string | null;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  activatedAt: Date | null;

  /**
   * When the eSIM was added to a phone (downloaded / installed), before it is
   * used — the second of the four moments of vande #011.
   */
  @Column({ type: 'timestamp', nullable: true })
  installedAt: Date | null;

  /** The phone's EID once the eSIM is on it (vande #011). */
  @Column({ type: 'varchar', length: 64, nullable: true })
  eid: string | null;

  /** The phone model the supplier reports, e.g. "iPhone 17 Pro Max". */
  @Column({ type: 'varchar', length: 120, nullable: true })
  deviceModel: string | null;

  @Column({ type: String, nullable: true })
  esimTranNo: string | null;

  @Column({ type: String, nullable: true })
  provider: string | null;

  @Column({ type: String, nullable: true })
  phoneNumber: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
