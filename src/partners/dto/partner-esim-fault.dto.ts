import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** Đối tác báo một eSIM đã mua bị lỗi (#046). */
export class ReportFaultyEsimDto {
  @ApiProperty({ example: 'PTN-1759000000-ABC123' })
  @IsString()
  @MinLength(1, { message: 'Thiếu mã đơn hàng.' })
  orderNumber!: string;

  @ApiProperty({ example: '8932042000012345678' })
  @IsString()
  @MinLength(1, { message: 'Thiếu ICCID của eSIM bị lỗi.' })
  iccid!: string;

  /**
   * Mô tả lỗi. Bắt buộc, vì người duyệt không có cách nào khác để biết nên
   * hoàn tiền hay không — một phiếu trống chỉ chuyển việc sang cho họ đi hỏi.
   */
  @ApiProperty({ example: 'Quét QR báo mã đã được dùng' })
  @IsString()
  @MinLength(5, { message: 'Vui lòng mô tả lỗi (ít nhất 5 ký tự).' })
  @MaxLength(500)
  reason!: string;
}

/** Admin duyệt hoặc từ chối một phiếu báo lỗi (#046). */
export class ReviewEsimFaultDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  approve!: boolean;

  /**
   * Số tiền hoàn. Bỏ trống thì hệ thống lấy giá vốn một eSIM của chính đơn đó
   * theo sổ ví — con số đối tác đã thực trả.
   */
  @ApiPropertyOptional({ example: 108000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  refundVnd?: number;

  @ApiPropertyOptional({ example: 'Nhà cung cấp xác nhận mã hỏng' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  adminNote?: string;
}
