import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** One rung of the membership ladder (#061). */
export class MembershipTierDto {
  /** The tier's code: a built-in one or one an admin added (vande #066). */
  @ApiProperty({ type: String, example: 'platinum' })
  tier!: string;

  @ApiProperty({ type: String, example: 'Bạch kim' })
  name!: string;

  @ApiPropertyOptional({ type: String, example: 'Platinum', nullable: true })
  nameEn!: string | null;

  @ApiProperty({ type: Number, example: 1_000_000 })
  minimumSpendVnd!: number;

  @ApiProperty({ type: Number, example: 3 })
  cashbackPercent!: number;

  @ApiProperty({ type: Number, example: 12_000 })
  referralRewardVnd!: number;
}
