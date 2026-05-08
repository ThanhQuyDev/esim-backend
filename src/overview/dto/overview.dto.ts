import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

export const OVERVIEW_PROVIDERS = [
  'airalo',
  'esimaccess',
  'gadgetkorea',
] as const;

export type OverviewProvider = (typeof OVERVIEW_PROVIDERS)[number];

export const COMPLETED_ORDER_STATUSES = ['paid'] as const;
export const COMPLETED_ORDER_ITEM_STATUSES = ['completed'] as const;
export const ACTIVE_ESIM_STATUSES = ['assigned', 'available'] as const;

export const PROVIDER_COMPARISON_METRICS = [
  'orders',
  'revenue',
  'plansSold',
  'successRate',
] as const;

export type ProviderComparisonMetric =
  (typeof PROVIDER_COMPARISON_METRICS)[number];

export const PROVIDER_COMPARISON_GROUP_BY = [
  'day',
  'week',
  'month',
  'provider',
] as const;

export type ProviderComparisonGroupBy =
  (typeof PROVIDER_COMPARISON_GROUP_BY)[number];

export const FINANCIAL_COMPARISON_GROUP_BY = [
  'day',
  'week',
  'month',
  'provider',
  'destination',
] as const;

export type FinancialComparisonGroupBy =
  (typeof FINANCIAL_COMPARISON_GROUP_BY)[number];

export const DEFAULT_TOP_DESTINATIONS_LIMIT = 10;
export const MAX_OVERVIEW_LIMIT = 50;

@ValidatorConstraint({ name: 'isOverviewDateRangeValid', async: false })
export class IsOverviewDateRangeValidConstraint implements ValidatorConstraintInterface {
  validate(_: unknown, args: ValidationArguments): boolean {
    const value = args.object as OverviewDateRangeQueryDto;
    if (!value.from || !value.to) {
      return true;
    }

    const from = new Date(value.from).getTime();
    const to = new Date(value.to).getTime();

    if (Number.isNaN(from) || Number.isNaN(to)) {
      return true;
    }

    return from <= to;
  }

  defaultMessage(): string {
    return 'from must be less than or equal to to';
  }
}

export class OverviewDateRangeQueryDto {
  @ApiPropertyOptional({
    type: String,
    example: '2026-01-01T00:00:00.000Z',
    description: 'Start date inclusive. Applied to order createdAt.',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    type: String,
    example: '2026-01-31T23:59:59.999Z',
    description: 'End date inclusive. Applied to order createdAt.',
  })
  @IsOptional()
  @IsDateString()
  @Validate(IsOverviewDateRangeValidConstraint)
  to?: string;
}

export class OverviewProviderFilterQueryDto extends OverviewDateRangeQueryDto {
  @ApiPropertyOptional({
    type: String,
    enum: OVERVIEW_PROVIDERS,
    description: 'Optional provider filter based on plan.provider.',
  })
  @IsOptional()
  @IsString()
  @IsIn(OVERVIEW_PROVIDERS)
  provider?: OverviewProvider;
}

export class ProviderComparisonQueryDto extends OverviewDateRangeQueryDto {
  @ApiPropertyOptional({
    type: String,
    enum: PROVIDER_COMPARISON_METRICS,
    default: 'orders',
  })
  @IsOptional()
  @IsIn(PROVIDER_COMPARISON_METRICS)
  metric?: ProviderComparisonMetric;

  @ApiPropertyOptional({
    type: String,
    enum: PROVIDER_COMPARISON_GROUP_BY,
    default: 'provider',
  })
  @IsOptional()
  @IsIn(PROVIDER_COMPARISON_GROUP_BY)
  groupBy?: ProviderComparisonGroupBy;
}

export class TopDestinationsQueryDto extends OverviewProviderFilterQueryDto {
  @ApiPropertyOptional({
    type: Number,
    default: DEFAULT_TOP_DESTINATIONS_LIMIT,
    maximum: MAX_OVERVIEW_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_OVERVIEW_LIMIT)
  limit?: number;
}

export class FinancialComparisonQueryDto extends OverviewProviderFilterQueryDto {
  @ApiPropertyOptional({
    type: String,
    enum: FINANCIAL_COMPARISON_GROUP_BY,
    default: 'day',
  })
  @IsOptional()
  @IsIn(FINANCIAL_COMPARISON_GROUP_BY)
  groupBy?: FinancialComparisonGroupBy;

  @ApiPropertyOptional({
    type: Number,
    default: DEFAULT_TOP_DESTINATIONS_LIMIT,
    maximum: MAX_OVERVIEW_LIMIT,
    description: 'Used when groupBy is destination.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_OVERVIEW_LIMIT)
  limit?: number;
}

export class OverviewSummaryResponseDto {
  @ApiProperty({ type: Number, example: 120 })
  totalOrders!: number;

  @ApiProperty({ type: Number, example: 90000000 })
  totalRevenue!: number;

  @ApiProperty({ type: Number, example: 150 })
  totalPlansSold!: number;

  @ApiProperty({ type: Number, example: 2300 })
  totalUsers!: number;

  @ApiProperty({ type: Number, example: 86 })
  activePlans!: number;

  @ApiProperty({ type: Number, example: 3 })
  failedOrders!: number;
}

export class ProviderComparisonItemDto {
  @ApiProperty({ type: String, example: 'airalo' })
  provider!: string;

  @ApiProperty({ type: Number, example: 42 })
  orders!: number;

  @ApiProperty({ type: Number, example: 35000000 })
  revenue!: number;

  @ApiProperty({ type: Number, example: 55 })
  plansSold!: number;

  @ApiProperty({ type: Number, example: 97.5 })
  successRate!: number;
}

export class ProviderComparisonSeriesItemDto {
  @ApiProperty({ type: String, example: '2026-01-01' })
  date!: string;

  [providerName: string]: string | number;
}

export class ProviderComparisonResponseDto {
  @ApiProperty({ type: [String], example: OVERVIEW_PROVIDERS })
  providers?: string[];

  @ApiProperty({ type: [ProviderComparisonSeriesItemDto], required: false })
  series?: ProviderComparisonSeriesItemDto[];

  @ApiProperty({ type: [ProviderComparisonItemDto], required: false })
  data?: ProviderComparisonItemDto[];
}

export class TopDestinationItemDto {
  @ApiPropertyOptional({ type: Number, example: 1 })
  destinationId?: number;

  @ApiProperty({ type: String, example: 'Vietnam' })
  destinationName!: string;

  @ApiProperty({ type: Number, example: 65 })
  plansPurchased!: number;

  @ApiProperty({ type: Number, example: 42000000 })
  revenue!: number;
}

export class TopDestinationsResponseDto {
  @ApiProperty({ type: [TopDestinationItemDto] })
  data!: TopDestinationItemDto[];
}

export class FinancialComparisonTotalsDto {
  @ApiProperty({ type: Number, example: 60000000 })
  costPrice!: number;

  @ApiProperty({ type: Number, example: 90000000 })
  totalRevenue!: number;

  @ApiProperty({ type: Number, example: 30000000 })
  profit!: number;

  @ApiProperty({ type: Number, example: 33.33 })
  profitMarginPercent!: number;
}

export class FinancialComparisonSeriesItemDto {
  @ApiProperty({ type: String, example: '2026-01-01' })
  date!: string;

  @ApiProperty({ type: Number, example: 6000000 })
  costPrice!: number;

  @ApiProperty({ type: Number, example: 9000000 })
  totalRevenue!: number;

  @ApiProperty({ type: Number, example: 3000000 })
  profit!: number;
}

export class FinancialComparisonGroupItemDto {
  @ApiProperty({ type: String, example: 'airalo' })
  group!: string;

  @ApiProperty({ type: Number, example: 6000000 })
  costPrice!: number;

  @ApiProperty({ type: Number, example: 9000000 })
  totalRevenue!: number;

  @ApiProperty({ type: Number, example: 3000000 })
  profit!: number;

  @ApiProperty({ type: Number, example: 33.33 })
  profitMarginPercent!: number;
}

export class FinancialComparisonResponseDto {
  @ApiProperty({ type: [FinancialComparisonSeriesItemDto], required: false })
  series?: FinancialComparisonSeriesItemDto[];

  @ApiProperty({ type: [FinancialComparisonGroupItemDto], required: false })
  data?: FinancialComparisonGroupItemDto[];

  @ApiProperty({ type: FinancialComparisonTotalsDto })
  totals!: FinancialComparisonTotalsDto;
}

export class OverviewResponseDto {
  @ApiProperty({ type: OverviewSummaryResponseDto })
  summary!: OverviewSummaryResponseDto;

  @ApiProperty({ type: ProviderComparisonResponseDto })
  providerComparison!: ProviderComparisonResponseDto;

  @ApiProperty({ type: TopDestinationsResponseDto })
  topDestinations!: TopDestinationsResponseDto;

  @ApiProperty({ type: FinancialComparisonResponseDto })
  financialComparison!: FinancialComparisonResponseDto;
}
