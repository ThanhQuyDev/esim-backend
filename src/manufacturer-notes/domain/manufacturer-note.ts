import { ApiProperty } from '@nestjs/swagger';

export class ManufacturerNote {
  @ApiProperty({ type: () => String, example: 'iPhone' })
  manufacturer: string;

  @ApiProperty({ type: () => String, example: 'vi' })
  language: string;

  @ApiProperty({ type: () => String })
  note: string;

  @ApiProperty({ type: () => Boolean, example: true })
  isActive: boolean;

  @ApiProperty({ type: String })
  id: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
