import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { CustomPaymentLinkStatus } from '../custom-payment-links.enum';

export class FindAllCustomPaymentLinksDto {
  @ApiPropertyOptional()
  @Transform(({ value }) => (value ? Number(value) : 1))
  @IsNumber()
  @IsOptional()
  page?: number;

  @ApiPropertyOptional()
  @Transform(({ value }) => (value ? Number(value) : 10))
  @IsNumber()
  @IsOptional()
  limit?: number;

  /** Narrow the history to one payment state (#084). */
  @ApiPropertyOptional({ enum: CustomPaymentLinkStatus })
  @IsOptional()
  @IsEnum(CustomPaymentLinkStatus)
  status?: CustomPaymentLinkStatus;

  /** Matches the customer email, the description or the order number. */
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  search?: string;
}
