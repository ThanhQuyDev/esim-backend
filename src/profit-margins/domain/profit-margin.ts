import { ApiProperty } from '@nestjs/swagger';

const idType = Number;

export class ProfitMargin {
  @ApiProperty({ type: idType })
  id: number;

  @ApiProperty({ type: String, example: 'Default Margin' })
  name: string;

  @ApiProperty({ type: Number, example: 30.0 })
  percentage: number;

  @ApiProperty({ type: Boolean, example: true })
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  deletedAt: Date;
}
