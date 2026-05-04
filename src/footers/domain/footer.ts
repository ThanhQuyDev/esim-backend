import { ApiProperty } from '@nestjs/swagger';

export class Footer {
  @ApiProperty({
    type: () => String,
    nullable: true,
  })
  categories?: string | null;

  @ApiProperty({
    type: () => String,
    nullable: false,
  })
  url: string;

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
    type: String,
  })
  id: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
