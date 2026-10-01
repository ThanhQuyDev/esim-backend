import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Transform, Type, plainToInstance } from 'class-transformer';
import { User } from '../domain/user';
import { RoleDto } from '../../roles/dto/role.dto';
import { MembershipTierEnum } from '../../wallets/tier/tier.enum';

export class FilterUserDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ type: RoleDto })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => RoleDto)
  roles?: RoleDto[] | null;

  /**
   * Mã khách hàng as staff sees it — `KH-000123` (#037). Whatever separators or
   * casing were typed, only the digits carry meaning: they are the user id. An
   * exact id match, because a code lookup that returned near-misses would be
   * worse than one that returns nothing.
   */
  @ApiPropertyOptional({ type: String, example: 'KH-000123' })
  @IsOptional()
  @IsString()
  customerCode?: string;

  /**
   * Hạng khách hàng (#037) — the EFFECTIVE tier, i.e. what the list column
   * shows: `tierOverride` when an admin set one, otherwise the tier the
   * customer's lifetime spend earns. Not a stored column, so the repository has
   * to translate it into the two cases.
   */
  @ApiPropertyOptional({ enum: MembershipTierEnum, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(MembershipTierEnum, { each: true })
  membershipTiers?: MembershipTierEnum[];

  /** Trạng thái (#037) — status ids: 1 = Active, 2 = Inactive. */
  @ApiPropertyOptional({ type: [Number], example: [1] })
  @IsOptional()
  @IsArray()
  @Transform(({ value }) =>
    Array.isArray(value) ? value.map((v) => Number(v)) : value,
  )
  @IsNumber({}, { each: true })
  statusIds?: number[];
}

export class SortUserDto {
  @ApiProperty()
  @Type(() => String)
  @IsString()
  orderBy: keyof User;

  @ApiProperty()
  @IsString()
  order: string;
}

export class QueryUserDto {
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
    value ? plainToInstance(FilterUserDto, JSON.parse(value)) : undefined,
  )
  @ValidateNested()
  @Type(() => FilterUserDto)
  filters?: FilterUserDto | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @Transform(({ value }) => {
    return value ? plainToInstance(SortUserDto, JSON.parse(value)) : undefined;
  })
  @ValidateNested({ each: true })
  @Type(() => SortUserDto)
  sort?: SortUserDto[] | null;
}
