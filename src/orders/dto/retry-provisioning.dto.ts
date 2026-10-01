import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Which lines of the order to re-send to the supplier (#014).
 *
 * Omitted means every line that qualifies, which is how the button behaved
 * before the picker existed. A selection narrows the run; it never overrides the
 * rule that a line with an eSIM, or one the supplier already accepted, is left
 * alone.
 */
export class RetryProvisioningDto {
  @ApiPropertyOptional({ type: [Number], example: [12, 13] })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @Type(() => Number)
  itemIds?: number[];
}
