import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChatRoomUserSummary {
  @ApiProperty({ type: Number })
  id: number;

  @ApiPropertyOptional({ type: String, nullable: true })
  email: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  firstName: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  lastName: string | null;
}

export class ChatRoom {
  @ApiProperty({ type: Number })
  id: number;

  /** -1 for a visitor without an account (vande-2011 #023). */
  @ApiProperty({ type: Number })
  userId: number;

  /** A visitor's conversation, not an account's (#023). */
  @ApiPropertyOptional({ type: Boolean })
  isGuest?: boolean;

  /**
   * Feature 5.1 — surface a small user summary (email + name) so the admin
   * CMS chat list can render the customer's email next to the conversation
   * without a separate users lookup.
   */
  @ApiPropertyOptional({ type: () => ChatRoomUserSummary, nullable: true })
  user?: ChatRoomUserSummary | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
