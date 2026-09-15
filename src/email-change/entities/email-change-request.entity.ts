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
 * A customer's pending email change (#057, #023).
 *
 * Two stages: `current` waits for the code mailed to the address the account
 * already has, then `new` waits for the code mailed to the new address.
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

  /** Which address the stored code was mailed to: `current` or `new`. */
  @Column({ type: String, length: 16, default: 'new' })
  stage!: string;

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
