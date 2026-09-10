import { ApiProperty } from '@nestjs/swagger';
import { MembershipTierEnum } from './tier.enum';

/** One rung of the membership ladder (#061). */
export class MembershipTierDto {
  @ApiProperty({ enum: MembershipTierEnum })
  tier!: MembershipTierEnum;

  @ApiProperty({ type: Number, example: 1_000_000 })
  minimumSpendVnd!: number;

  @ApiProperty({ type: Number, example: 3 })
  cashbackPercent!: number;

  @ApiProperty({ type: Number, example: 12_000 })
  referralRewardVnd!: number;
}
