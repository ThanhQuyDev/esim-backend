import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const idType = Number;

export class RegionRef {
  @ApiProperty({ type: Number })
  id: number;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: String })
  slug: string;

  @ApiPropertyOptional({ type: String })
  avatarUrl: string | null;
}

export class Destination {
  @ApiProperty({
    type: idType,
  })
  id: number;

  @ApiProperty({
    type: String,
    example: 'Japan',
  })
  name: string;

  @ApiProperty({
    type: String,
    example: 'japan',
  })
  slug: string;

  @ApiProperty({
    type: String,
    example: 'JP',
  })
  countryCode: string;

  @ApiPropertyOptional({ type: Number, example: 1 })
  parentId: number | null;

  @ApiPropertyOptional({
    type: String,
    example: 'https://example.com/flags/jp.png',
  })
  flagUrl: string | null;

  @ApiPropertyOptional({
    type: String,
    example: 'https://example.com/avatars/japan.png',
  })
  avatarUrl: string | null;

  @ApiPropertyOptional({
    type: String,
    example: 'japan nippon tokyo',
  })
  keySearch: string | null;

  @ApiProperty({
    type: Boolean,
    example: false,
  })
  isPopular: boolean;

  @ApiProperty({
    type: Boolean,
    example: true,
  })
  isActive: boolean;

  @ApiPropertyOptional({
    type: String,
    example: 'High-speed 4G/5G coverage across Japan',
  })
  description: string | null;

  @ApiPropertyOptional({ type: () => [RegionRef] })
  regions?: RegionRef[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  deletedAt: Date;
}
