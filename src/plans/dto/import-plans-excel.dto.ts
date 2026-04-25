import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ImportPlansExcelDto {
  @ApiProperty({
    example: 'esimaccess',
    description: 'Provider name (applied to all imported plans)',
  })
  @IsNotEmpty()
  @IsString()
  provider: string;

  @ApiProperty({
    description:
      'JSON string mapping plan fields to Excel column names. ' +
      'Keys are plan fields, values are the Excel column header names.',
    example: JSON.stringify({
      providerPlanId: 'Plan ID',
      name: 'Plan Name',
      countryCode: 'Country',
      durationDays: 'Duration',
      dataMb: 'Data (MB)',
      costPrice: 'Cost',
      price: 'Price',
      retailPrice: 'Retail Price',
      currency: 'Currency',
      sms: 'SMS',
      call: 'Call',
      type: 'Type',
    }),
  })
  @IsNotEmpty()
  @IsString()
  columnMapping: string;

  @ApiPropertyOptional({
    description:
      'Sheet name or index (0-based) to read from. Defaults to first sheet.',
    example: '0',
  })
  @IsOptional()
  @IsString()
  sheet?: string;
}

/** Parsed column mapping type used internally */
export type PlanColumnMapping = Partial<
  Record<
    | 'providerPlanId'
    | 'name'
    | 'slug'
    | 'countryCode'
    | 'destinationId'
    | 'regionId'
    | 'durationDays'
    | 'dataMb'
    | 'costPrice'
    | 'price'
    | 'retailPrice'
    | 'currency'
    | 'sms'
    | 'call'
    | 'type'
    | 'topUp'
    | 'isActive'
    | 'speed'
    | 'operatorName'
    | 'fupSpeed',
    string
  >
>;
