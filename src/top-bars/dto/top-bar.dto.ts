import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class TopBarDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  id: string;
}
