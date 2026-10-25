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

  /** Order of a brand's notes on the page, lowest first (vande #042). */
  @ApiProperty({ type: () => Number, example: 0 })
  sortOrder: number;

  @ApiProperty({ type: String })
  id: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
