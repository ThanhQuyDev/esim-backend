import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const idType = Number;

export class Region {
  @ApiProperty({ type: idType })
  id: number;

  @ApiProperty({ type: String, example: 'Asia' })
  name: string;

  @ApiProperty({ type: String, example: 'asia' })
  slug: string;

  @ApiPropertyOptional({ type: idType, example: 1 })
  parentId: number | null;

  @ApiPropertyOptional({ type: () => Region })
  parent?: Region | null;

  @ApiPropertyOptional({ type: () => [Region] })
  children?: Region[];

  @ApiPropertyOptional({ type: String })
  avatarUrl: string | null;

  @ApiProperty({ type: Boolean, example: true })
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  deletedAt: Date;
}
