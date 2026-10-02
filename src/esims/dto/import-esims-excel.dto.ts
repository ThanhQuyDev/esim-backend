import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class ImportEsimsExcelDto {
  @ApiPropertyOptional({
    type: String,
    example: 'Wintel',
    description:
      'Local carrier for every row, e.g. "Viettel", "Wintel". Takes precedence over the "Carrier" column, which is only used when this is omitted.',
  })
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiPropertyOptional({
    type: String,
    example: 'VN',
    description:
      'Country code. If omitted, read from "Country Code" column in Excel.',
  })
  @IsOptional()
  @IsString()
  countryCode?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Sheet name or 0-based index',
  })
  @IsOptional()
  @IsString()
  sheet?: string;

  /**
   * Loại eSIM đang nhập. Hai nút nhập riêng trong admin gửi hai giá trị khác
   * nhau, vì cùng một nhà mạng có thể bán cả hai loại:
   *
   * - `domestic` — eSIM nội địa, hiện ở tab riêng cạnh Quốc gia / Khu vực.
   * - `travel`   — eSIM du lịch của nhà mạng trong nước (Viettel), hiện ở
   *   Quốc gia → Việt Nam cùng các gói du lịch khác.
   *
   * Bỏ trống thì mặc định `travel`: đó là loại đã tồn tại từ trước, nên một
   * lệnh nhập cũ không tự nhiên biến hàng của mình thành eSIM nội địa.
   */
  @ApiPropertyOptional({
    enum: ['domestic', 'travel'],
    default: 'travel',
    description:
      'domestic = eSIM nội địa (its own tab); travel = travel eSIM from a Vietnamese carrier (listed under Quốc gia → Việt Nam).',
  })
  @IsOptional()
  @IsIn(['domestic', 'travel'])
  esimKind?: 'domestic' | 'travel';
}
