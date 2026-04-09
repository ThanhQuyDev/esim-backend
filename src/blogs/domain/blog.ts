import { ApiProperty } from '@nestjs/swagger';

export class Blog {
  @ApiProperty({
    type: () => String,
    nullable: false,
  })
  language: string;

  @ApiProperty({
    type: () => Date,
    nullable: true,
  })
  publishedAt?: Date | null;

  @ApiProperty({
    type: () => Boolean,
    nullable: false,
  })
  isPublished?: boolean;

  @ApiProperty({
    type: () => String,
    nullable: true,
  })
  author?: string | null;

  @ApiProperty({
    type: () => String,
    nullable: true,
  })
  tags?: string | null;

  @ApiProperty({
    type: () => String,
    nullable: true,
  })
  coverImage?: string | null;

  @ApiProperty({
    type: () => String,
    nullable: true,
  })
  excerpt?: string | null;

  @ApiProperty({
    type: () => String,
    nullable: false,
  })
  content: string;

  @ApiProperty({
    type: () => String,
    nullable: false,
  })
  slug: string;

  @ApiProperty({
    type: () => String,
    nullable: false,
  })
  title: string;

  @ApiProperty({
    type: String,
  })
  id: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
