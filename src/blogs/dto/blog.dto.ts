import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class BlogDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  id: string;
}
