import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

/** Postgres hands bigint and numeric back as strings. */
const numberTransformer = {
  to: (value: number) => value,
  from: (value: string | number | null) => Number(value ?? 0),
};

/** What one membership tier requires and pays, as edited in the CMS (#024). */
@Entity({ name: 'membership_tier_config' })
export class MembershipTierConfigEntity extends EntityRelationalHelper {
  /** A built-in code or one an admin added, e.g. "kim-cuong" (vande #066). */
  @PrimaryColumn({ type: 'varchar', length: 32 })
  tier!: string;

  /** The name customers and admins read (vande #066). */
  @Column({ type: 'varchar', length: 60, nullable: true })
  name!: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  nameEn!: string | null;

  @Column({ type: 'bigint', default: 0, transformer: numberTransformer })
  minimumSpendVnd!: number;

  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 0,
    transformer: numberTransformer,
  })
  cashbackPercent!: number;

  @Column({ type: 'bigint', default: 0, transformer: numberTransformer })
  referralRewardVnd!: number;

  @UpdateDateColumn()
  updatedAt!: Date;
}
