import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import { ChatService } from './chat.service';
import { ChatRoom } from './domain/chat-room';

/**
 * Feature 5.1 — Admin chat-rooms HTTP API.
 *
 *   GET /api/v1/admin/chat-rooms                 → list all conversations
 *   GET /api/v1/admin/chat-rooms?email=foo@bar   → narrow to rooms whose
 *                                                   owner email contains
 *                                                   "foo@bar" (ILIKE).
 *
 * The websocket gateway already exposes `getRooms` for the admin live view;
 * this controller provides the same data over plain HTTP so the CMS filter
 * box can do live filtering / debouncing without a websocket round-trip.
 */
@ApiBearerAuth()
@ApiTags('Admin Chat')
@Roles(RoleEnum.admin)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'admin/chat-rooms', version: '1' })
export class AdminChatRoomsController {
  constructor(private readonly chatService: ChatService) {}

  @Get()
  @ApiOkResponse({ type: ChatRoom, isArray: true })
  @ApiQuery({
    name: 'email',
    required: false,
    type: String,
    description:
      'Filter chat rooms by customer email (partial match, case-insensitive).',
  })
  async findAll(@Query('email') email?: string) {
    const trimmedEmail = email?.trim();
    return this.chatService.getAllRooms(
      trimmedEmail ? { email: trimmedEmail } : undefined,
    );
  }
}
