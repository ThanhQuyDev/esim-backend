import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Destination } from '../../destinations/domain/destination';

const idType = Number;

export class Region {
  @ApiProperty({ type: idType })
  id: number;

  @ApiProperty({ type: String, example: 'Europe' })
  name: string;

  @ApiProperty({ type: String, example: 'europe' })
  slug: string;

  @ApiPropertyOptional({ type: () => [Destination] })
  destinations?: Destination[];

  @ApiPropertyOptional({ type: Number, example: 42 })
  destinationCount?: number;

  @ApiPropertyOptional({
    type: String,
    example: 'airalo,esimaccess',
  })
  providers?: string | null;

  @ApiPropertyOptional({ type: String })
  avatarUrl: string | null;

  @ApiPropertyOptional({
    type: String,
    example: 'Explore Europe with high-speed data coverage',
  })
  description: string | null;

  @ApiPropertyOptional({
    type: String,
    example: 'Khám phá Châu Âu với phủ sóng dữ liệu tốc độ cao',
  })
  descriptionVi: string | null;

  @ApiProperty({ type: Boolean, example: true })
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  deletedAt: Date;
}
