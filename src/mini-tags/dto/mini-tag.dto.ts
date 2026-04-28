import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class MiniTagDto {
  @ApiProperty()
  @IsString()
  id: string;
}
