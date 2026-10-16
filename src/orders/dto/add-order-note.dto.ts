import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/** "Thêm ghi chú" on an order (doitac-1410 #067). */
export class AddOrderNoteDto {
  @ApiProperty({
    example: 'Khách gọi hotline báo chưa nhận email, đã gửi lại.',
  })
  @IsString()
  @MinLength(2, { message: 'Vui lòng nhập nội dung ghi chú.' })
  @MaxLength(2000, { message: 'Ghi chú tối đa 2000 ký tự.' })
  body!: string;
}
