import { ApiProperty } from '@nestjs/swagger';

export class HelpCenter {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String, nullable: true })
  slug?: string | null;

  @ApiProperty({ type: String, nullable: true })
  language?: string | null;

  @ApiProperty({ type: String })
  title: string;

  @ApiProperty({ type: String })
  content: string;

  @ApiProperty({ type: Number })
  order: number;

  @ApiProperty({ type: String })
  category: string;

  @ApiProperty({ type: String })
  parent: string;

  @ApiProperty({ type: Boolean, default: false })
  isPopular: boolean;

  @ApiProperty({ type: Boolean, default: true })
  isPublished: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
