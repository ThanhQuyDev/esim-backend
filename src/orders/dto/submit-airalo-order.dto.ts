import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  IsIn,
} from 'class-validator';

export class SubmitAiraloOrderDto {
  @ApiProperty({ example: 'kallur-digital-7days-1gb' })
  @IsString()
  @IsNotEmpty()
  packageId: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({ enum: ['sim', 'esim'], default: 'sim' })
  @IsOptional()
  @IsIn(['sim', 'esim'])
  type?: 'sim' | 'esim';

  @ApiPropertyOptional({ example: '1 sim kallur-digital-7days-1gb' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class AiraloOrderResponseDto {
  @ApiProperty()
  request_id: string;

  @ApiProperty()
  accepted_at: string;
}
