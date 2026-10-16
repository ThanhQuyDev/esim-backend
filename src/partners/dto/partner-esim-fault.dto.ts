import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
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
  // 2000 characters, as the brief allows (doitac-1410 #039).
  @MaxLength(2000, { message: 'Mô tả tối đa 2000 ký tự.' })
  reason!: string;

  /** `fault` = Báo lỗi, `refund` = Yêu cầu hoàn tiền (doitac-1410 #039). */
  @ApiPropertyOptional({ enum: ['fault', 'refund'] })
  @IsOptional()
  @IsIn(['fault', 'refund'])
  kind?: 'fault' | 'refund';

  /** Uploaded images / videos describing the problem. */
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  attachments?: string[];
}

/**
 * "Báo lỗi" / "Yêu cầu hoàn tiền" for a whole order (doitac-1410 #042): the
 * order is in the URL and there is no ICCID — one order can hold many eSIMs.
 */
export class PurchaseRequestDto {
  @ApiProperty({ enum: ['fault', 'refund'] })
  @IsIn(['fault', 'refund'])
  kind!: 'fault' | 'refund';

  @ApiProperty({ example: 'Khách quét QR báo mã đã được dùng' })
  @IsString()
  @MinLength(5, { message: 'Vui lòng mô tả lý do (ít nhất 5 ký tự).' })
  @MaxLength(2000, { message: 'Mô tả tối đa 2000 ký tự.' })
  reason!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  attachments?: string[];
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
