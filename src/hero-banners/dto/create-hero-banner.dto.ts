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
  IsBoolean,
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
    required: false,
    type: () => FileDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => FileDto)
  @IsNotEmptyObject()
  image?: FileDto | null;

  // Don't forget to use the class-validator decorators in the DTO properties.
}
