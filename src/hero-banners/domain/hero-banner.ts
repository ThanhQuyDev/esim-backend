import { ApiProperty } from '@nestjs/swagger';

export class HeroBanner {
  @ApiProperty({
    type: () => Boolean,
    nullable: false,
  })
  active: boolean;

  @ApiProperty({
    type: () => String,
    nullable: false,
  })
  title: string;

  @ApiProperty({
    type: () => String,
    nullable: false,
  })
  firstIcon: string;

  @ApiProperty({
    type: () => String,
    nullable: false,
  })
  firstContent: string;

  @ApiProperty({
    type: () => String,
    nullable: false,
  })
  secondIcon: string;

  @ApiProperty({
    type: () => String,
    nullable: false,
  })
  secondContent: string;

  @ApiProperty({
    type: () => String,
    nullable: false,
  })
  description: string;

  @ApiProperty({
    type: () => String,
    nullable: false,
  })
  language: string;

  @ApiProperty({
    type: () => String,
    nullable: true,
    description:
      'Hero image URL. Null falls back to the built-in picture (#089).',
  })
  image?: string | null;

  @ApiProperty({
    type: String,
  })
  id: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
