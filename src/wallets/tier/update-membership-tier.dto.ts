import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

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

  /** The name customers and admins read (vande #066). */
  @ApiPropertyOptional({ type: String, example: 'Bạch kim' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name?: string;

  @ApiPropertyOptional({ type: String, example: 'Platinum', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  nameEn?: string | null;
}

/** A tier the admin adds, e.g. "Kim cương" (vande #066). */
export class CreateMembershipTierDto {
  @ApiProperty({ type: String, example: 'Kim cương' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name!: string;

  @ApiPropertyOptional({ type: String, example: 'Diamond' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  nameEn?: string | null;

  /** Made from the name when left out: "Kim cương" → "kim-cuong". */
  @ApiPropertyOptional({ type: String, example: 'kim-cuong' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  code?: string;

  @ApiProperty({ type: Number, example: 100_000_000 })
  @IsInt()
  @Min(1)
  minimumSpendVnd!: number;

  @ApiProperty({ type: Number, example: 10 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  cashbackPercent!: number;

  @ApiProperty({ type: Number, example: 30_000 })
  @IsInt()
  @Min(0)
  referralRewardVnd!: number;
}
