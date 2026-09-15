import { ApiProperty } from '@nestjs/swagger';

export class Footer {
  @ApiProperty({
    type: () => String,
    nullable: true,
    description: 'Column heading (default/English); also the grouping key.',
  })
  categories?: string | null;

  @ApiProperty({
    type: () => String,
    nullable: true,
    description: 'Column heading in Vietnamese; falls back to categories.',
  })
  categoriesVi?: string | null;

  @ApiProperty({
    type: () => String,
    nullable: false,
  })
  url: string;

  @ApiProperty({
    type: () => String,
    nullable: true,
    description: 'URL on the English site; falls back to url (Vietnamese).',
  })
  urlEn?: string | null;

  @ApiProperty({
    type: () => String,
    nullable: false,
  })
  title: string;

  @ApiProperty({
    type: () => String,
    nullable: false,
  })
  titleVi: string;

  @ApiProperty({
    type: () => String,
    nullable: true,
  })
  iconUrl?: string | null;

  @ApiProperty({ type: Number, example: 10 })
  sortOrder: number;

  @ApiProperty({
    type: String,
  })
  id: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
