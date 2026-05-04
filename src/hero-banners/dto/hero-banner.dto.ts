import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class HeroBannerDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  id: string;
}
