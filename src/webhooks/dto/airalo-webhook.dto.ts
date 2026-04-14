import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AiraloWebhookSimDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  iccid: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lpa?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  matching_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  qrcode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  qrcode_url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  airalo_code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  apn_type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  apn_value?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  is_roaming?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  confirmation_code?: string;
}

export class AiraloWebhookOrderDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  id?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  created_at?: string;

  @ApiPropertyOptional()
  @IsOptional()
  sims?: AiraloWebhookSimDto[];
}

export class AiraloWebhookPayloadDto {
  @ApiPropertyOptional({ description: 'Event type, e.g. order.completed' })
  @IsOptional()
  @IsString()
  event?: string;

  @ApiPropertyOptional({ description: 'Request ID for async orders' })
  @IsOptional()
  @IsString()
  request_id?: string;

  @ApiPropertyOptional({ description: 'Accepted at timestamp' })
  @IsOptional()
  @IsString()
  accepted_at?: string;

  @ApiPropertyOptional()
  @IsOptional()
  order?: AiraloWebhookOrderDto;
}
