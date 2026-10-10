import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

/**
 * One row of the APN lookup table uploaded from Excel (#065).
 *
 * One row per APN, every app split by device platform — the real sheet tracks all
 * four that way (`cmhk` runs TikTok on an iPhone but not on an Android), so the
 * table does too and an import stays a straight copy.
 */
@Entity({ name: 'apn_support' })
export class ApnSupportEntity extends EntityRelationalHelper {
  /** Lower-cased and trimmed, so a plan's APN can be matched directly. */
  @Index({ unique: true })
  @Column({ nullable: false, type: String })
  apn: string;

  /** The APN exactly as the sheet spelled it, for the CMS list. */
  @Column({ nullable: false, type: String })
  apnLabel: string;

  @Column({ nullable: false, type: Boolean, default: false })
  tiktokIos: boolean;

  @Column({ nullable: false, type: Boolean, default: false })
  tiktokAndroid: boolean;

  @Column({ nullable: false, type: Boolean, default: false })
  chatGptIos: boolean;

  @Column({ nullable: false, type: Boolean, default: false })
  chatGptAndroid: boolean;

  @Column({ nullable: false, type: Boolean, default: false })
  geminiIos: boolean;

  @Column({ nullable: false, type: Boolean, default: false })
  geminiAndroid: boolean;

  @Column({ nullable: false, type: Boolean, default: false })
  claudeIos: boolean;

  @Column({ nullable: false, type: Boolean, default: false })
  claudeAndroid: boolean;

  /** Free-text column from the sheet, if it carries one. */
  @Column({ nullable: true, type: String })
  note?: string | null;

  /** Auto-added from plans, app columns not filled in yet (#044). */
  @Column({ nullable: false, type: Boolean, default: false })
  needsReview: boolean;

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
