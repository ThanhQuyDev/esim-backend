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
        // unread for admin = messages sent by user (not admin) that are unread
        // senderId !== adminId, but we don't know adminId here, so count all unread
        const unreadCount = await this.chatMessageRepository.countUnread(
          room.id,
          0,
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
  ): Promise<ChatMessage> {
    return this.chatMessageRepository.create({
      chatRoomId,
      senderId,
      message,
      fileUrl: attachment?.fileUrl,
      fileName: attachment?.fileName,
      fileType: attachment?.fileType,
      fileSize: attachment?.fileSize,
    });
  }

  async markAsRead(chatRoomId: number, readerId: number): Promise<void> {
    return this.chatMessageRepository.markRoomAsRead(chatRoomId, readerId);
  }
}
