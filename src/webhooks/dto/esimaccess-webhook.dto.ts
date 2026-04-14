import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EsimAccessWebhookEsimDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  iccid: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  smdpAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  activationCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  qrCodeUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;
}

export class EsimAccessWebhookOrderDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  orderNo: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  packageCode: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  count?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  periodStartTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  periodEndTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  esimList?: EsimAccessWebhookEsimDto[];
}

export class EsimAccessWebhookPayloadDto {
  @ApiProperty({ description: 'Event type, e.g. ORDER_COMPLETE' })
  @IsString()
  @IsNotEmpty()
  notifyType: string;

  @ApiProperty()
  order: EsimAccessWebhookOrderDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timestamp?: string;
}
