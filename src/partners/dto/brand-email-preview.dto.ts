import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

/** The brand as it stands in the "Cấu hình thương hiệu" form (doitac-3010 #004). */
export class BrandEmailPreviewDto {
  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  brandInfo?: Record<string, unknown>;
}
