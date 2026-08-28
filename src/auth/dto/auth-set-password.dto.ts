import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, MinLength } from 'class-validator';

export class AuthSetPasswordDto {
  @ApiProperty()
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}
