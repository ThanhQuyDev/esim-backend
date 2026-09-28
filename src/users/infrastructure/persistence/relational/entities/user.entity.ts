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
  OneToOne,
} from 'typeorm';
import { RoleEntity } from '../../../../../roles/infrastructure/persistence/relational/entities/role.entity';
import { StatusEntity } from '../../../../../statuses/infrastructure/persistence/relational/entities/status.entity';
import { FileEntity } from '../../../../../files/infrastructure/persistence/relational/entities/file.entity';

import { AuthProvidersEnum } from '../../../../../auth/auth-providers.enum';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { MembershipTierEnum } from '../../../../../wallets/tier/tier.enum';
import { AuthorProfileEntity } from '../../../../../authors/infrastructure/persistence/relational/entities/author-profile.entity';

@Entity({
  name: 'user',
})
export class UserEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  // For "string | null" we need to use String type.
  // More info: https://github.com/typeorm/typeorm/issues/2567
  @Column({ type: String, unique: true, nullable: true })
  email: string | null;

  @Column({ nullable: true })
  password?: string;

  @Column({ default: AuthProvidersEnum.email })
  provider: string;

  @Index()
  @Column({ type: String, nullable: true })
  socialId?: string | null;

  @Index()
  @Column({ type: String, nullable: true })
  firstName: string | null;

  @Index()
  @Column({ type: String, nullable: true })
  lastName: string | null;

  @Column({ type: String, nullable: true })
  phoneNumber: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 0, default: 0 })
  lifetimeSpendVnd: number;

  @Column({ type: String, nullable: true })
  tierOverride: MembershipTierEnum | null;

  @Column({ type: String, nullable: true })
  tierOverrideReason: string | null;

  @OneToOne(() => FileEntity, {
    eager: true,
  })
  @JoinColumn()
  photo?: FileEntity | null;

  @OneToOne(() => AuthorProfileEntity, (profile) => profile.user, {
    eager: true,
  })
  authorProfile?: AuthorProfileEntity | null;

  @ManyToOne(() => RoleEntity, {
    eager: true,
  })
  role?: RoleEntity | null;

  @ManyToOne(() => StatusEntity, {
    eager: true,
  })
  status?: StatusEntity;

  /**
   * When this account last signed in (#060).
   *
   * The partner list reports "hoạt động gần nhất" from this rather than from
   * the last order: a partner who checks their commission daily and has not
   * sold this month is active, and one whose orders arrive through a link they
   * posted a year ago is not.
   */
  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt?: Date | null;

  /**
   * Set when an admin created this account and the password was emailed
   * (#059). The holder signs in with it once and is made to set their own —
   * a password that has travelled through an inbox must not stay the account's.
   */
  @Column({ type: Boolean, default: false })
  mustChangePassword?: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
