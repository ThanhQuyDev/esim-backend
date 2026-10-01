import { Exclude, Expose } from 'class-transformer';
import { FileType } from '../../files/domain/file';
import { Role } from '../../roles/domain/role';
import { Status } from '../../statuses/domain/status';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  MembershipTierEnum,
  TierSourceEnum,
} from '../../wallets/tier/tier.enum';
import { TierBenefits } from '../../wallets/tier/tier.constants';
import { AuthorProfile } from '../../authors/domain/author-profile';

const idType = Number;

export class User {
  @ApiProperty({
    type: idType,
  })
  id: number | string;

  @ApiProperty({
    type: String,
    example: 'john.doe@example.com',
  })
  @Expose({ groups: ['me', 'admin'] })
  email: string | null;

  @Exclude({ toPlainOnly: true })
  password?: string;

  @ApiProperty({
    type: Boolean,
    example: true,
  })
  @Expose({ groups: ['me', 'admin'] })
  hasPassword?: boolean;

  /**
   * The password was minted by an admin and emailed, so it has to be replaced
   * before the account is really theirs (#059). The portal reads this from the
   * sign-in response and sends them straight to the change-password screen.
   */
  @ApiProperty({ type: Boolean, example: false })
  @Expose({ groups: ['me', 'admin'] })
  mustChangePassword?: boolean;

  /** When this account last signed in (#060). */
  @ApiProperty({ type: Date, nullable: true })
  @Expose({ groups: ['me', 'admin'] })
  lastLoginAt?: Date | null;

  @ApiProperty({
    type: String,
    example: 'email',
  })
  @Expose({ groups: ['me', 'admin'] })
  provider: string;

  @ApiProperty({
    type: String,
    example: '1234567890',
  })
  @Expose({ groups: ['me', 'admin'] })
  socialId?: string | null;

  @ApiProperty({
    type: String,
    example: 'John',
  })
  firstName: string | null;

  @ApiProperty({
    type: String,
    example: 'Doe',
  })
  lastName: string | null;

  @ApiProperty({
    type: String,
    example: '+84901234567',
  })
  phoneNumber: string | null;

  @ApiProperty({ type: Number, example: 1000000 })
  lifetimeSpendVnd: number;

  /**
   * The customer's own referral code (`user_referral_profile.code`) — the code
   * they hand out, not one they used. Filled in for the admin customer list
   * (#056); undefined elsewhere.
   */
  @ApiPropertyOptional({ type: String, nullable: true, example: 'ESIM8F2K' })
  referralCode?: string | null;

  /**
   * How many orders this customer has actually paid for. Counted with the same
   * status set the revenue dashboards use, so the two never disagree (#056).
   */
  @ApiPropertyOptional({ type: Number, example: 3 })
  paidOrderCount?: number;

  /**
   * Spendable eXu right now (#038) — the same figure
   * `WalletsService.getAvailableBalance` returns: zero while the wallet is
   * locked or past its expiry, and net of eXu already held against an order.
   * Filled in for the admin customer list; undefined elsewhere.
   */
  @ApiPropertyOptional({ type: Number, example: 50000 })
  exuBalanceVnd?: number;

  /**
   * What the wallet ledger holds, before expiry, lock or holds are applied
   * (#038). Carried so the list can explain a spendable balance of 0 instead of
   * looking like the eXu vanished.
   */
  @ApiPropertyOptional({ type: Number, example: 70000 })
  exuGrossBalanceVnd?: number;

  /** eXu committed to an order that has not been paid yet (#038). */
  @ApiPropertyOptional({ type: Number, example: 20000 })
  exuHeldVnd?: number;

  /**
   * When the eXu balance expires (#038) — 365 days, pushed back each time the
   * customer earns more. Null means nothing has ever been earned.
   */
  @ApiPropertyOptional({ type: Date, nullable: true })
  exuExpiresAt?: Date | null;

  /** `user_wallet.status` — `active` unless an admin locked it (#038). */
  @ApiPropertyOptional({ type: String, nullable: true, example: 'active' })
  exuWalletStatus?: string | null;

  @ApiPropertyOptional({ enum: MembershipTierEnum, nullable: true })
  tierOverride: MembershipTierEnum | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  tierOverrideReason: string | null;

  @ApiProperty({ enum: MembershipTierEnum })
  automaticTier?: MembershipTierEnum;

  @ApiProperty({ enum: MembershipTierEnum })
  membershipTier?: MembershipTierEnum;

  @ApiProperty({ enum: TierSourceEnum })
  tierSource?: TierSourceEnum;

  @ApiProperty({ type: Object })
  tierBenefits?: TierBenefits;

  @ApiProperty({
    type: () => FileType,
  })
  photo?: FileType | null;

  @ApiPropertyOptional({ type: () => AuthorProfile, nullable: true })
  authorProfile?: AuthorProfile | null;

  @ApiProperty({
    type: () => Role,
  })
  role?: Role | null;

  @ApiProperty({
    type: () => Status,
  })
  status?: Status;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  deletedAt: Date;
}
