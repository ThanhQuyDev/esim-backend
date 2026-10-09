import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** One plan of an order placed on a customer's behalf, with its quantity. */
export class SubmitManualOrderItemDto {
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

  /**
   * Several plans in one order, each with its own quantity (#031, test round
   * 4). When given, the single-plan fields below are ignored.
   */
  @ApiPropertyOptional({ type: [SubmitManualOrderItemDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SubmitManualOrderItemDto)
  items?: SubmitManualOrderItemDto[];

  @ApiPropertyOptional({
    example: 'JC056',
    description:
      "Single-plan order: provider package code (must match the plan's providerPlanId)",
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  packageCode?: string;

  @ApiPropertyOptional({
    example: 'ID_1_7',
    description: 'Single-plan order: plan slug',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  slug?: string;

  @ApiPropertyOptional({ example: 2, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}
