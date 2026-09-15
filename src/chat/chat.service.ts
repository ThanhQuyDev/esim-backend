import { Injectable } from '@nestjs/common';
import { ChatRoomRepository } from './infrastructure/persistence/chat-room.repository';
import { ChatMessageRepository } from './infrastructure/persistence/chat-message.repository';
import { ChatRoom } from './domain/chat-room';
import { ChatMessage } from './domain/chat-message';
import { NullableType } from '../utils/types/nullable.type';

@Injectable()
export class ChatService {
  constructor(
    private readonly chatRoomRepository: ChatRoomRepository,
    private readonly chatMessageRepository: ChatMessageRepository,
  ) {}

  async getOrCreateRoom(userId: number): Promise<ChatRoom> {
    const existing = await this.chatRoomRepository.findByUserId(userId);
    if (existing) return existing;
    return this.chatRoomRepository.create({ userId });
  }

  async getRoomById(id: number): Promise<NullableType<ChatRoom>> {
    return this.chatRoomRepository.findById(id);
  }

  async getAllRooms(filter?: {
    email?: string;
  }): Promise<
    Array<
      ChatRoom & { lastMessage: NullableType<ChatMessage>; unreadCount: number }
    >
  > {
    // Feature 5.1 — pass the optional email filter down to the repository so
    // a partial-email match returns only the matching conversations.
    const rooms = await this.chatRoomRepository.findAllWithLastMessage(filter);
    return Promise.all(
      rooms.map(async (room) => {
        const lastMessage = await this.chatMessageRepository.findLastByRoomId(
          room.id,
        );
        // What the admin still has to answer: unread messages the CUSTOMER wrote.
        // Counting every unread message also counted the admin's own replies
        // the customer had not opened yet, so a conversation waiting on the
        // customer showed up as waiting on the admin (#032).
        const unreadCount = await this.chatMessageRepository.countUnreadFrom(
          room.id,
          room.userId,
        );
        return { ...room, lastMessage, unreadCount };
      }),
    );
  }

  async getMessages(
    chatRoomId: number,
    page: number,
    limit: number,
  ): Promise<ChatMessage[]> {
    return this.chatMessageRepository.findByRoomId(chatRoomId, page, limit);
  }

  async sendMessage(
    chatRoomId: number,
    senderId: number | null,
    message: string,
    attachment?: {
      fileUrl?: string;
      fileName?: string;
      fileType?: string;
      fileSize?: number;
    },
    /** Quoted message id — validated by the caller to be in the same room (#073). */
    replyToId?: number | null,
  ): Promise<ChatMessage> {
    return this.chatMessageRepository.create({
      chatRoomId,
      senderId,
      message,
      fileUrl: attachment?.fileUrl,
      fileName: attachment?.fileName,
      fileType: attachment?.fileType,
      fileSize: attachment?.fileSize,
      replyToId: replyToId ?? null,
    });
  }

  /** Used to check a quoted message exists and belongs to the room (#073). */
  async getMessageById(id: number): Promise<ChatMessage | null> {
    return this.chatMessageRepository.findById(id);
  }

  async markAsRead(chatRoomId: number, readerId: number): Promise<void> {
    return this.chatMessageRepository.markRoomAsRead(chatRoomId, readerId);
  }
}
