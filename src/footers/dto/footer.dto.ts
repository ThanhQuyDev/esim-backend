import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class FooterDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  id: string;
}
