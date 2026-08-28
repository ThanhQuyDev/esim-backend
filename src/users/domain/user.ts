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
