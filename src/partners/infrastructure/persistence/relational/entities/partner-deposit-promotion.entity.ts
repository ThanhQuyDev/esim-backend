import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

/**
 * A deposit promotion (doitac-1410 #015): top up at least `minDepositVnd`
 * between `startsAt` and `endsAt` and the wallet gets `bonusPercent` more,
 * up to `maxBonusVnd`. The admin sets them up; several may be planned ahead.
 */
@Entity({ name: 'partner_deposit_promotion' })
export class PartnerDepositPromotionEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: String })
  name!: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  bonusPercent!: number;

  @Column({ type: 'decimal', precision: 14, scale: 0 })
  minDepositVnd!: number;

  /** Null: no ceiling on the bonus of one top-up. */
  @Column({ type: 'decimal', precision: 14, scale: 0, nullable: true })
  maxBonusVnd?: number | null;

  @Column({ type: 'timestamptz' })
  startsAt!: Date;

  @Column({ type: 'timestamptz' })
  endsAt!: Date;

  @Column({ type: Boolean, default: true })
  isActive!: boolean;

  @Column({ type: Number, nullable: true })
  createdByAdminId?: number | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
