import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { HelpCenterCategory, HelpCenterParent } from '../domain/help-center';

export class CreateHelpCenterDto {
  @ApiProperty({ required: true, type: () => String })
  @IsString()
  title: string;

  @ApiProperty({ required: true, type: () => String })
  @IsString()
  content: string;

  @ApiProperty({ required: false, type: () => Number, default: 0 })
  @IsOptional()
  @IsNumber()
  order?: number;

  @ApiProperty({ required: true, enum: HelpCenterCategory })
  @IsEnum(HelpCenterCategory)
  category: HelpCenterCategory;

  @ApiProperty({ required: true, enum: HelpCenterParent })
  @IsEnum(HelpCenterParent)
  parent: HelpCenterParent;
}
