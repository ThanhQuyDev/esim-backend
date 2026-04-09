import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class WhyChooseUsDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  id: string;
}
