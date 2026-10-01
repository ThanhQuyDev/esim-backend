import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class SubmitManualOrderDto {
  @ApiProperty({
    example: 'khachquen@example.com',
    description:
      'Buyer email. An account is created for it when none exists yet (#041).',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  /**
   * Buyer's name, used only when the account has to be created (#041). Left out,
   * the new account has no name rather than one guessed from the email.
   */
  @ApiPropertyOptional({ example: 'Nguyễn Văn A' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  customerName?: string;

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
