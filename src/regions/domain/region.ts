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

  @ApiPropertyOptional({ type: String })
  avatarUrl: string | null;

  @ApiProperty({ type: Boolean, example: true })
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  deletedAt: Date;
}
