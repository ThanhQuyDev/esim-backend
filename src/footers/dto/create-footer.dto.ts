import {
  // decorators here

  IsString,
  IsOptional,
} from 'class-validator';

import {
  // decorators here
  ApiProperty,
} from '@nestjs/swagger';

export class CreateFooterDto {
  @ApiProperty({
    required: false,
    type: () => String,
  })
  @IsOptional()
  @IsString()
  categories?: string | null;

  @ApiProperty({
    required: true,
    type: () => String,
  })
  @IsString()
  url: string;

  @ApiProperty({
    required: true,
    type: () => String,
  })
  @IsString()
  title: string;

  @ApiProperty({
    required: true,
    type: () => String,
  })
  @IsString()
  titleVi: string;

  // Don't forget to use the class-validator decorators in the DTO properties.
}
