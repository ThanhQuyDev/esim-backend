import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuthorProfile {
  @ApiProperty({ type: Number })
  id: number;

  @ApiProperty({ type: Number })
  userId: number;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: String })
  slug: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  avatar?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  description?: string | null;
}
