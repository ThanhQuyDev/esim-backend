import { ApiProperty } from '@nestjs/swagger';
import { MENU_SLIDE_KEYS } from '../menu-slide-keys';

export class MenuSlide {
  @ApiProperty({
    type: () => String,
    enum: MENU_SLIDE_KEYS,
    nullable: false,
    description: 'Which mega-menu panel the slide belongs to',
  })
  menuKey: string;

  @ApiProperty({
    type: () => String,
    nullable: false,
  })
  title: string;

  @ApiProperty({
    type: () => String,
    nullable: false,
  })
  description: string;

  @ApiProperty({
    type: () => String,
    nullable: false,
    example: '/goi-esim',
  })
  href: string;

  @ApiProperty({
    type: () => String,
    nullable: false,
  })
  image: string;

  @ApiProperty({
    type: () => String,
    nullable: true,
  })
  imageAlt?: string | null;

  @ApiProperty({
    type: () => String,
    example: 'vi',
  })
  language: string;

  @ApiProperty({
    type: () => Number,
    example: 0,
    description: 'Display order inside the panel; lower first',
  })
  sortOrder: number;

  @ApiProperty({
    type: () => Boolean,
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    type: String,
  })
  id: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
