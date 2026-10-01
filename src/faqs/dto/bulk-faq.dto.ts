import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsUUID,
} from 'class-validator';

/**
 * Upper bound on one bulk call (#051). Generous next to a page of 10-50 rows, but
 * it stops a hand-crafted request from asking to delete the whole table at once —
 * and a FAQ delete is permanent, so the ceiling matters more here than it does
 * for a soft-deleted record.
 */
const MAX_BULK_IDS = 500;

export class BulkFaqIdsDto {
  @ApiProperty({
    type: [String],
    example: ['0f7c2f3a-5f7a-4a1e-9d0b-6b2f9c8e4a11'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_BULK_IDS)
  @IsUUID('4', { each: true })
  ids: string[];
}

export class BulkFaqStatusDto extends BulkFaqIdsDto {
  @ApiProperty({ type: Boolean, example: false })
  @IsBoolean()
  isActive: boolean;
}
