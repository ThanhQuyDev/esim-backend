import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

/** Admin edit of one membership tier (#024). Omitted fields stay as they are. */
export class UpdateMembershipTierDto {
  @ApiPropertyOptional({ type: Number, example: 1_000_000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  minimumSpendVnd?: number;

  @ApiPropertyOptional({ type: Number, example: 3 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  cashbackPercent?: number;

  @ApiPropertyOptional({ type: Number, example: 12_000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  referralRewardVnd?: number;
}
