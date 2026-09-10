import {
  // decorators here

  IsString,
  IsOptional,
  IsInt,
  Min,
} from 'class-validator';

import {
  // decorators here
  ApiProperty,
} from '@nestjs/swagger';

export class CreateFooterDto {
  @ApiProperty({ required: false, type: Number, example: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  /** Column heading (default/English) — also the grouping key (#088). */
  @ApiProperty({
    required: false,
    type: () => String,
  })
  @IsOptional()
  @IsString()
  categories?: string | null;

  /** Column heading in Vietnamese. */
  @ApiProperty({
    required: false,
    type: () => String,
  })
  @IsOptional()
  @IsString()
  categoriesVi?: string | null;

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

  @ApiProperty({
    required: false,
    type: () => String,
  })
  @IsOptional()
  @IsString()
  iconUrl?: string | null;

  // Don't forget to use the class-validator decorators in the DTO properties.
}
