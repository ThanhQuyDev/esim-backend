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

  @ApiPropertyOptional({ type: String, example: 'chau-au' })
  slugVi: string | null;

  @ApiPropertyOptional({
    type: String,
    example: 'esimaccess-cn',
    description:
      'Stable provider-derived identity key. Used by cron sync to match an existing region regardless of CMS edits to name/slug.',
  })
  externalCode?: string | null;

  @ApiPropertyOptional({ type: () => [Destination] })
  destinations?: Destination[];

  @ApiPropertyOptional({ type: Number, example: 42 })
  destinationCount?: number;

  @ApiPropertyOptional({
    type: String,
    example: 'airalo,esimaccess',
  })
  providers?: string | null;

  @ApiPropertyOptional({
    type: String,
    example: 'eSIM Europe - High Speed Data Coverage',
  })
  title: string | null;

  @ApiPropertyOptional({
    type: String,
    example: 'eSIM Châu Âu - Phủ Sóng Tốc Độ Cao',
  })
  titleVi: string | null;

  @ApiPropertyOptional({
    type: String,
    example: '<p>Install the eSIM <strong>before</strong> you leave.</p>',
    description:
      'Note shown at the top of the website page, sanitised HTML (doitac-1410 #078).',
  })
  notice?: string | null;

  @ApiPropertyOptional({
    type: String,
    example: '<p>Cài eSIM <strong>trước</strong> khi khởi hành.</p>',
  })
  noticeVi?: string | null;

  @ApiPropertyOptional({ type: String })
  avatarUrl: string | null;

  @ApiPropertyOptional({ type: String })
  iconUrl: string | null;

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

  @ApiProperty({ type: Boolean, example: false })
  isPopular: boolean;

  @ApiPropertyOptional({
    type: Number,
    example: 38,
    description:
      "Parent region (vande #035): this region is listed as another pack on the parent's page.",
  })
  parentId?: number | null;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Ticked "Làm khu vực cha" (vande-0411 #073).',
  })
  isParent?: boolean;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description:
      'Place among the five on the home page on a phone (vande-1411 #021).',
  })
  mobileHomeRank?: number | null;

  @ApiPropertyOptional({
    type: String,
    enum: ['travel', 'local'],
    description: 'Travel, or a domestic eSIM carrier page (vande-1411 #025).',
  })
  esimType?: string;

  /** The parent's name, when a plan list asks for its region. */
  parentName?: string | null;

  /**
   * In a list: its parent's slugs and names, so a pack's card can link to the
   * parent's page when the parent is not in the same page of results
   * (vande-1411 #028).
   */
  parent?: {
    slug: string;
    slugVi: string | null;
    name: string;
    title: string | null;
    titleVi: string | null;
    /** Its pictures, for a pack with none of its own (vande-1411 #029). */
    avatarUrl?: string | null;
    iconUrl?: string | null;
  } | null;

  @ApiProperty({
    type: Number,
    example: 120,
    description:
      "Units sold across this region's plans, recounted hourly (#053).",
  })
  /** Written by the recount job only, so new regions leave it to the DB default. */
  soldCount?: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  deletedAt: Date;

  @ApiPropertyOptional({
    type: Number,
    example: 120000,
    description: 'Cheapest plan price (VND) in this region',
  })
  fromPrice?: number | null;
}
