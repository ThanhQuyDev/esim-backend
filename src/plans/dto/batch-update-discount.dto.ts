import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber, ArrayMinSize, Max, Min } from 'class-validator';

export class BatchUpdateDiscountDto {
  @ApiProperty({ example: [1, 2, 3], type: [Number] })
  @IsArray()
  @ArrayMinSize(1)
  @IsNumber({}, { each: true })
  ids: number[];

  @ApiProperty({
    example: 20,
    type: Number,
    description: 'Discount percentage (0-100)',
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  discount: number;
}
