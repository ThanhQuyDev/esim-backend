import { ApiProperty } from '@nestjs/swagger';
import { MiniTag } from '../../mini-tags/domain/mini-tag';
import { Plan } from '../../plans/domain/plan';
import { Faq } from '../../faqs/domain/faq';
import { AuthorProfile } from '../../authors/domain/author-profile';

export class Blog {
  @ApiProperty({ type: () => String, nullable: false })
  language: string;

  @ApiProperty({ type: () => Date, nullable: true })
  publishedAt?: Date | null;

  @ApiProperty({ type: () => Boolean, nullable: false })
  isPublished?: boolean;

  @ApiProperty({ type: () => AuthorProfile, nullable: true })
  authorProfile?: AuthorProfile | null;

  @ApiProperty({ type: () => Number, nullable: true })
  authorProfileId?: number | null;

  @ApiProperty({ type: () => String, nullable: true })
  authorSlug?: string | null;

  @ApiProperty({ type: () => String, nullable: true })
  authorBio?: string | null;

  @ApiProperty({ type: () => String, nullable: true })
  author?: string | null;

  @ApiProperty({ type: () => String, nullable: true })
  authorAvatar?: string | null;

  @ApiProperty({ type: () => String, nullable: true })
  category?: string | null;

  @ApiProperty({ type: () => String, nullable: true })
  parent?: string | null;

  @ApiProperty({ type: () => String, nullable: true })
  coverImage?: string | null;

  @ApiProperty({ type: () => String, nullable: true })
  excerpt?: string | null;

  @ApiProperty({ type: () => String, nullable: false })
  content: string;

  @ApiProperty({ type: () => String, nullable: false })
  slug: string;

  @ApiProperty({ type: () => String, nullable: false })
  title: string;

  @ApiProperty({ type: () => Number, nullable: true })
  timeRead?: number | null;

  @ApiProperty({ type: String })
  id: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: () => MiniTag, nullable: true })
  miniTag?: MiniTag | null;

  @ApiProperty({ type: () => [Plan], nullable: true })
  plans?: Plan[];

  @ApiProperty({ type: () => [Number], nullable: true })
  planIds?: number[];

  @ApiProperty({ type: () => [Faq], nullable: true })
  faqs?: Faq[];

  @ApiProperty({ type: () => [String], nullable: true })
  faqIds?: string[];

  @ApiProperty({ type: () => Boolean, nullable: false })
  faqEnabled?: boolean;

  @ApiProperty({ type: () => Boolean, nullable: false })
  isPopular?: boolean;
}
