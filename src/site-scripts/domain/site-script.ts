import { ApiProperty } from '@nestjs/swagger';
import { SITE_SCRIPT_PLACEMENTS } from '../site-script-placements';

export class SiteScript {
  @ApiProperty({ type: () => String, example: 'Google Analytics 4' })
  name: string;

  @ApiProperty({
    type: () => String,
    description: 'The snippet, stored and served exactly as pasted',
  })
  content: string;

  @ApiProperty({ enum: SITE_SCRIPT_PLACEMENTS, example: 'head' })
  placement: string;

  @ApiProperty({ type: () => Boolean, example: true })
  isActive: boolean;

  @ApiProperty({
    type: () => Number,
    example: 0,
    description:
      'Order within the placement; a gtag config must follow its loader',
  })
  sortOrder: number;

  @ApiProperty({ type: String })
  id: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
