import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';

const lower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RequestEmailChangeDto {
  @ApiProperty({ example: 'new.email@example.com' })
  @Transform(lower)
  @IsEmail()
  email!: string;
}

export class ConfirmEmailChangeDto {
  @ApiProperty({ example: 'new.email@example.com' })
  @Transform(lower)
  @IsEmail()
  email!: string;

  /** 6-digit code mailed to the new address. */
  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  code!: string;
}
