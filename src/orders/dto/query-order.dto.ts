import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Transform, Type, plainToInstance } from 'class-transformer';
import { Order } from '../domain/order';
import { InvoiceStatus } from '../../invoices/invoices.enum';

/**
 * The three kinds of order an admin sorts by (#017).
 *
 * `esim` is deliberately "an ordinary purchase": not a topup AND with no partner
 * commission, so the three are mutually exclusive and the counts add up.
 */
export const ORDER_KIND_VALUES = ['esim', 'affiliate', 'topup'] as const;
export type OrderKind = (typeof ORDER_KIND_VALUES)[number];

export class FilterOrderDto {
  @ApiPropertyOptional({
    type: String,
    description: 'Single status or comma-separated statuses',
  })
  @IsOptional()
  status?: string | string[];

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsNumber()
  userId?: number;

  @ApiPropertyOptional({
    type: String,
    description:
      'Filter by eSIM ICCID (exact match on targetIccid or order-item iccid)',
  })
  @IsOptional()
  @IsString()
  iccid?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Filter by plan name (partial match)',
  })
  @IsOptional()
  @IsString()
  planName?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Filter by buyer email (partial match)',
  })
  @IsOptional()
  @IsString()
  userEmail?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Filter by order number / order code (partial match)',
  })
  @IsOptional()
  @IsString()
  orderNumber?: string;

  @ApiPropertyOptional({
    type: Boolean,
    description:
      'true = orders with a VAT invoice request, false = orders without one (#051)',
  })
  @IsOptional()
  @IsBoolean()
  hasInvoice?: boolean;

  @ApiPropertyOptional({
    enum: InvoiceStatus,
    description: 'Orders whose invoice request is in this status (#051)',
  })
  @IsOptional()
  @IsIn(Object.values(InvoiceStatus))
  invoiceStatus?: InvoiceStatus;

  @ApiPropertyOptional({
    type: String,
    enum: ORDER_KIND_VALUES,
    description:
      'esim = an ordinary eSIM purchase, affiliate = one that earned a partner ' +
      'a commission, topup = a recharge of an existing eSIM (#017)',
  })
  @IsOptional()
  @IsIn(ORDER_KIND_VALUES)
  kind?: OrderKind;

  @ApiPropertyOptional({
    type: String,
    format: 'date',
    description: 'Orders created on or after this date, inclusive (#017)',
  })
  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date',
    description:
      'Orders created on or before this date. A bare date counts the whole day (#017)',
  })
  @IsOptional()
  @IsDateString()
  createdTo?: string;
}

export class SortOrderDto {
  @ApiProperty()
  @Type(() => String)
  @IsString()
  orderBy: keyof Order;

  @ApiProperty()
  @IsString()
  order: string;
}

export class QueryOrderDto {
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

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @Transform(({ value }) =>
    value ? plainToInstance(FilterOrderDto, JSON.parse(value)) : undefined,
  )
  @ValidateNested()
  @Type(() => FilterOrderDto)
  filters?: FilterOrderDto | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @Transform(({ value }) => {
    return value ? plainToInstance(SortOrderDto, JSON.parse(value)) : undefined;
  })
  @ValidateNested({ each: true })
  @Type(() => SortOrderDto)
  sort?: SortOrderDto[] | null;
}
