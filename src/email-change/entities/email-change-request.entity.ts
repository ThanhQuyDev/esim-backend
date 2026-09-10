import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../utils/relational-entity-helper';

/**
 * A customer's pending email change, waiting for the code sent to the NEW
 * address (#057).
 *
 * Kept apart from the `otp` table on purpose: that one holds login codes, and a
 * login code must never be usable to move someone's account to another address.
 */
@Entity({ name: 'email_change_request' })
export class EmailChangeRequestEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id!: number;

  /** The customer is identified by id throughout — never by their old email. */
  @Index({ unique: true })
  @Column({ type: Number })
  userId!: number;

  @Column({ type: String, length: 255 })
  newEmail!: string;

  @Column({ type: String, length: 255 })
  codeHash!: string;

  @Column({ type: 'timestamp' })
  expiresAt!: Date;

  @Column({ type: Number, default: 0 })
  attempts!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
