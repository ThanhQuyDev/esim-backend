import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class FaqDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  id: string;
}
