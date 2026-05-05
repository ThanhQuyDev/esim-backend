import {
  // decorators here

  IsBoolean,
  IsString,
  IsIn,
} from 'class-validator';

import {
  // decorators here
  ApiProperty,
} from '@nestjs/swagger';

export class CreateHeroBannerDto {
  @ApiProperty({
    required: true,
    type: () => Boolean,
  })
  @IsBoolean()
  active: boolean;

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
  firstIcon: string;

  @ApiProperty({
    required: true,
    type: () => String,
  })
  @IsString()
  firstContent: string;

  @ApiProperty({
    required: true,
    type: () => String,
  })
  @IsString()
  secondIcon: string;

  @ApiProperty({
    required: true,
    type: () => String,
  })
  @IsString()
  secondContent: string;

  @ApiProperty({
    required: true,
    type: () => String,
  })
  @IsString()
  description: string;

  @ApiProperty({
    required: true,
    type: () => String,
    example: 'en',
    description: 'Language code: en or vi',
  })
  @IsString()
  @IsIn(['en', 'vi'])
  language: string;

  // Don't forget to use the class-validator decorators in the DTO properties.
}
