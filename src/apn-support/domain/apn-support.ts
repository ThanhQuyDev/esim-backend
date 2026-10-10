import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApnSupport {
  @ApiProperty({ type: () => String, example: 'cmhk' })
  apn: string;

  @ApiProperty({
    type: () => String,
    example: 'CMHK',
    description: 'The APN as the uploaded sheet spelled it',
  })
  apnLabel: string;

  @ApiProperty({ type: () => Boolean, example: true })
  tiktokIos: boolean;

  @ApiProperty({ type: () => Boolean, example: false })
  tiktokAndroid: boolean;

  @ApiProperty({ type: () => Boolean, example: true })
  chatGptIos: boolean;

  @ApiProperty({ type: () => Boolean, example: true })
  chatGptAndroid: boolean;

  @ApiProperty({ type: () => Boolean, example: true })
  geminiIos: boolean;

  @ApiProperty({ type: () => Boolean, example: true })
  geminiAndroid: boolean;

  @ApiProperty({ type: () => Boolean, example: false })
  claudeIos: boolean;

  @ApiProperty({ type: () => Boolean, example: false })
  claudeAndroid: boolean;

  @ApiPropertyOptional({ type: () => String })
  note?: string | null;

  /**
   * Added automatically from a supplier's plans and not filled in yet (#044,
   * test round 4): its app columns mean "chưa có thông tin", not "không hỗ
   * trợ", and it is left out when judging plans.
   */
  @ApiPropertyOptional({ type: () => Boolean })
  needsReview?: boolean;

  @ApiProperty({ type: String })
  id: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
