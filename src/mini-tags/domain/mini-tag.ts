import { ApiProperty } from '@nestjs/swagger';

export class MiniTag {
  @ApiProperty({
    type: String,
  })
  id: string;

  @ApiProperty({
    type: () => String,
    nullable: true,
  })
  image?: string | null;

  @ApiProperty({
    type: () => String,
    nullable: false,
  })
  title: string;

  @ApiProperty({
    type: () => String,
    nullable: true,
  })
  description?: string | null;

  @ApiProperty({
    type: () => String,
    nullable: true,
  })
  contentButton?: string | null;

  @ApiProperty({
    type: () => String,
    nullable: true,
  })
  linkUrl?: string | null;

  @ApiProperty({
    type: () => String,
    nullable: true,
    description: 'English title; English posts fall back to title (#059).',
  })
  titleEn?: string | null;

  @ApiProperty({ type: () => String, nullable: true })
  descriptionEn?: string | null;

  @ApiProperty({ type: () => String, nullable: true })
  contentButtonEn?: string | null;

  @ApiProperty({
    type: () => String,
    nullable: true,
    description: 'Link for English posts, e.g. the /en page (#059).',
  })
  linkUrlEn?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
