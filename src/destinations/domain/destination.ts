import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Region } from '../../regions/domain/region';

const idType = Number;

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

  @ApiPropertyOptional({
    type: () => [Region],
  })
  regions?: Region[];

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

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  deletedAt: Date;
}
