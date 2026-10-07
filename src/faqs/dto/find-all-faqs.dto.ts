import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Transform, Type, plainToInstance } from 'class-transformer';

export class FilterFaqDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  search?: string;

  /** Trạng thái hoạt động, for the CMS list filter (#050). */
  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /**
   * The CMS "Trang" box (v3 #004): matches the FAQ's page URL only, so typing
   * "destination" lists the destination pages' FAQs and not the home page FAQ
   * whose answer happens to contain the word.
   */
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  pageUrl?: string;
}

export class FindAllFaqsDto {
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
    value ? plainToInstance(FilterFaqDto, JSON.parse(value)) : undefined,
  )
  @ValidateNested()
  @Type(() => FilterFaqDto)
  filters?: FilterFaqDto;
}
