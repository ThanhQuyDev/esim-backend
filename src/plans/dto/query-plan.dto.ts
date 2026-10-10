import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Transform, Type, plainToInstance } from 'class-transformer';
import { Plan } from '../domain/plan';

export class FilterPlanDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    type: String,
    description:
      "Part of the plan's provider code or slug — the admin's order-on-behalf picker (#031).",
  })
  @IsOptional()
  @IsString()
  planCode?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  isCheapest?: boolean;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Filter by local-inventory flag (domestic eSIM plans)',
  })
  @IsOptional()
  @IsBoolean()
  isLocalInventory?: boolean;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Filter by eSIM nội địa (its own homepage tab)',
  })
  @IsOptional()
  @IsBoolean()
  isDomesticEsim?: boolean;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsNumber()
  destinationId?: number;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsNumber()
  regionId?: number;

  @ApiPropertyOptional({
    type: String,
    description:
      'Filter by country/region: matches plan country code, destination country code/name/keySearch or region name/slug',
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({
    type: Boolean,
    description:
      'true: only plans with call or SMS quota; false: only plans without both',
  })
  @IsOptional()
  @IsBoolean()
  hasCallSms?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsString({ each: true })
  provider?: string[];

  @ApiPropertyOptional({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    description:
      'Exact APN(s), chosen from /plans/apn-options (#010). Several = any of them (#018, test round 4).',
  })
  @IsOptional()
  @IsString({ each: true })
  apn?: string | string[];

  @ApiPropertyOptional({
    type: Boolean,
    description:
      'Exit IP is local rather than routed via Hong Kong, i.e. TikTok and ChatGPT work (#010, #041)',
  })
  @IsOptional()
  @IsBoolean()
  isNonHkIp?: boolean;

  /**
   * Set by the service, not the client: APNs the APN table says run TikTok on
   * every device and ChatGPT, so the "TikTok & ChatGPT" filter matches those
   * plans too, not only the esimaccess exit-IP flag (#045, test round 4).
   */
  tiktokApns?: string[];

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Whether the plan can be topped up (#010)',
  })
  @IsOptional()
  @IsBoolean()
  topUp?: boolean;

  @ApiPropertyOptional({
    type: Number,
    description: 'Filter by duration in days',
  })
  @IsOptional()
  @IsNumber()
  duration?: number;

  @ApiPropertyOptional({
    type: String,
    description:
      'Filter by plan type (fixed, unlimited, daily, etc.) — single value, comma-separated, or array',
  })
  @IsOptional()
  type?: string | string[];

  @ApiPropertyOptional({
    type: String,
    description: 'Filter by data amount (e.g. 1GB, 50GB)',
  })
  @IsOptional()
  @IsString()
  data?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Filter by tags (popular, best seller, new, hot deal)',
  })
  @IsOptional()
  @IsString({ each: true })
  tags?: string[];
}

export class SortPlanDto {
  @ApiProperty()
  @Type(() => String)
  @IsString()
  orderBy: keyof Plan;

  @ApiProperty()
  @IsString()
  order: string;
}

export class QueryPlanDto {
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
  @Transform(({ value }) => {
    if (!value) return undefined;
    return plainToInstance(FilterPlanDto, JSON.parse(value));
  })
  @ValidateNested()
  @Type(() => FilterPlanDto)
  filters?: FilterPlanDto | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @Transform(({ value }) => {
    return value ? plainToInstance(SortPlanDto, JSON.parse(value)) : undefined;
  })
  @ValidateNested({ each: true })
  @Type(() => SortPlanDto)
  sort?: SortPlanDto[] | null;
}
