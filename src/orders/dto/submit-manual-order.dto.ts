import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class SubmitManualOrderDto {
  @ApiProperty({ example: 'khachquen@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: 'JC056',
    description: "Provider package code (must match the plan's providerPlanId)",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  packageCode: string;

  @ApiProperty({
    example: 'ID_1_7',
    description: 'Plan slug (primary identifier used for lookup)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  slug: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity: number;
}
