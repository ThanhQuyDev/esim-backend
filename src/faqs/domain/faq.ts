import { ApiProperty } from '@nestjs/swagger';

export class Faq {
  @ApiProperty({
    type: () => String,
    nullable: true,
  })
  url?: string | null;

  @ApiProperty({
    type: () => String,
    nullable: false,
  })
  language: string;

  @ApiProperty({
    type: () => Boolean,
    nullable: false,
  })
  isActive?: boolean;

  @ApiProperty({
    type: () => Number,
    nullable: false,
  })
  sortOrder: number;

  @ApiProperty({
    type: () => String,
    nullable: false,
  })
  answer: string;

  @ApiProperty({
    type: () => String,
    nullable: false,
  })
  question: string;

  @ApiProperty({
    type: String,
  })
  id: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
