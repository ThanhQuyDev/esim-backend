import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

/**
 * Một lần đối tác phân phối đặt mua (#046).
 *
 * Cố ý **không có trần số lượng**: chốt 02/10/2026, đủ tiền trong ví là mua
 * được. `Min(1)` chỉ chặn số 0 và số âm.
 */
export class CreatePartnerPurchaseDto {
  @ApiProperty({ example: 123 })
  @Type(() => Number)
  @IsInt({ message: 'Gói không hợp lệ.' })
  @Min(1, { message: 'Gói không hợp lệ.' })
  planId!: number;

  @ApiProperty({ example: 100 })
  @Type(() => Number)
  @IsInt({ message: 'Số lượng phải là số nguyên.' })
  @Min(1, { message: 'Số lượng phải từ 1 trở lên.' })
  quantity!: number;
}
