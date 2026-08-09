import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsNumber,
} from 'class-validator';

export class BulkDeleteEsimsDto {
  @ApiProperty({ type: [Number], example: [1, 2, 3] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @IsNumber({}, { each: true })
  @Type(() => Number)
  ids: number[];
}

export class BulkDeleteEsimsResponseDto {
  @ApiProperty({ type: Number })
  deleted: number;
}
