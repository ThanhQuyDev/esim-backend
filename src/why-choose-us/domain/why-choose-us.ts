import { ApiProperty } from '@nestjs/swagger';

export class WhyChooseUs {
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
    nullable: true,
  })
  icon?: string | null;

  @ApiProperty({
    type: () => String,
    nullable: false,
  })
  description: string;

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
