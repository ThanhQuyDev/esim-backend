import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/** "Khoá tài khoản" (security 15/11/2026): the reason is for admins only. */
export class LockUserDto {
  @ApiProperty({ example: 'Lấy eSIM không thanh toán qua API cũ' })
  @IsString()
  @MinLength(3, { message: 'Vui lòng nhập lý do khoá.' })
  @MaxLength(500)
  reason!: string;
}
