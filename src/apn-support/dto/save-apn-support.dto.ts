import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/** Add one APN row by hand in the CMS (#044, test round 4). */
export class CreateApnSupportDto {
  @ApiProperty({ example: 'cmhk' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  apnLabel: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() tiktokIos?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() tiktokAndroid?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() chatGptIos?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() chatGptAndroid?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() geminiIos?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() geminiAndroid?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() claudeIos?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() claudeAndroid?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}

export class UpdateApnSupportDto extends PartialType(CreateApnSupportDto) {}
