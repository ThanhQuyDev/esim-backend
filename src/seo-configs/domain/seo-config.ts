import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SeoConfig {
  @ApiProperty({ type: Number })
  id: number;

  @ApiProperty({ type: String, example: '/destinations/japan' })
  url: string;

  @ApiPropertyOptional({ type: String, example: 'Buy Japan eSIM - Best Plans' })
  metaTitle: string | null;

  @ApiPropertyOptional({
    type: String,
    example: 'Get the best Japan eSIM plans with 4G/5G coverage.',
  })
  metaDescription: string | null;

  @ApiPropertyOptional({
    type: String,
    example: 'japan esim, japan travel sim',
  })
  metaKeywords: string | null;

  @ApiPropertyOptional({
    type: String,
    example: 'https://example.com/og-japan.png',
  })
  ogImage: string | null;

  @ApiPropertyOptional({ type: String, example: 'Buy Japan eSIM' })
  ogTitle: string | null;

  @ApiPropertyOptional({ type: String, example: 'Best Japan eSIM plans.' })
  ogDescription: string | null;

  // Link to destination (optional)
  @ApiPropertyOptional({ type: Number, example: 1 })
  destinationId: number | null;

  // Link to region (optional)
  @ApiPropertyOptional({ type: Number, example: 1 })
  regionId: number | null;

  // Link to plan (optional)
  @ApiPropertyOptional({ type: Number, example: 1 })
  planId: number | null;

  @ApiProperty({ type: Boolean, example: true })
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  deletedAt: Date;
}
