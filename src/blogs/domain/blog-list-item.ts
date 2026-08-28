import { ApiProperty } from '@nestjs/swagger';
import { MiniTag } from '../../mini-tags/domain/mini-tag';
import { AuthorProfile } from '../../authors/domain/author-profile';

export class BlogListItem {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: () => String, nullable: false })
  language: string;

  @ApiProperty({ type: () => String, nullable: false })
  title: string;

  @ApiProperty({ type: () => String, nullable: false })
  slug: string;

  @ApiProperty({ type: () => String, nullable: true })
  excerpt?: string | null;

  @ApiProperty({ type: () => String, nullable: true })
  coverImage?: string | null;

  @ApiProperty({ type: () => AuthorProfile, nullable: true })
  authorProfile?: AuthorProfile | null;

  @ApiProperty({ type: () => String, nullable: true })
  authorSlug?: string | null;

  @ApiProperty({ type: () => String, nullable: true })
  author?: string | null;

  @ApiProperty({ type: () => String, nullable: true })
  category?: string | null;

  @ApiProperty({ type: () => Number, nullable: true })
  timeRead?: number | null;

  @ApiProperty({ type: () => Boolean, nullable: false })
  isPublished?: boolean;

  @ApiProperty({ type: () => Date, nullable: true })
  publishedAt?: Date | null;

  @ApiProperty({ type: () => MiniTag, nullable: true })
  miniTag?: MiniTag | null;

  @ApiProperty({ type: () => [Number], nullable: true })
  planIds?: number[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
