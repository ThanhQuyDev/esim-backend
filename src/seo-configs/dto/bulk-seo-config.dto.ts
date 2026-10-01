import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Upper bound on one bulk call (#049). Generous next to a page of 10-50 rows,
 * but it stops a hand-crafted request from asking to delete the whole table in
 * one statement.
 */
const MAX_BULK_IDS = 500;

export class BulkSeoConfigIdsDto {
  @ApiProperty({ type: [Number], example: [1, 2, 3] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_BULK_IDS)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  ids: number[];
}

export class BulkSeoConfigStatusDto extends BulkSeoConfigIdsDto {
  @ApiProperty({ type: Boolean, example: false })
  @IsBoolean()
  isActive: boolean;
}
