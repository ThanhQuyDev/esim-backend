import { FileDto } from '../../files/dto/file.dto';

import {
  // decorators here
  Type,
} from 'class-transformer';

import {
  // decorators here

  ValidateNested,
  IsNotEmptyObject,
  IsOptional,
  IsString,
} from 'class-validator';

import {
  // decorators here
  ApiProperty,
} from '@nestjs/swagger';

export class CreateTopBarDto {
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
  buttonContent: string;

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

  @ApiProperty({
    required: false,
    type: () => FileDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => FileDto)
  @IsNotEmptyObject()
  icon?: FileDto | null;

  // Don't forget to use the class-validator decorators in the DTO properties.
}
