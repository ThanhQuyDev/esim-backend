import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

/** Second step of a two-step sign-in (vande-1411 #005). */
export class AuthTwoFactorLoginDto {
  @ApiProperty({ description: 'The challenge the password step returned' })
  @IsString()
  @Matches(/^[0-9a-f]{64}$/)
  challenge: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Mã xác thực gồm 6 chữ số.' })
  code: string;
}

export class AuthTwoFactorResendDto {
  @ApiProperty()
  @IsString()
  @Matches(/^[0-9a-f]{64}$/)
  challenge: string;
}

export class TwoFactorDisableDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Mã xác nhận gồm 6 chữ số.' })
  code: string;
}
