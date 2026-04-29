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

  async getAllRooms(): Promise<
    Array<
      ChatRoom & { lastMessage: NullableType<ChatMessage>; unreadCount: number }
    >
  > {
    const rooms = await this.chatRoomRepository.findAllWithLastMessage();
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
    senderId: number,
    message: string,
  ): Promise<ChatMessage> {
    return this.chatMessageRepository.create({ chatRoomId, senderId, message });
  }

  async markAsRead(chatRoomId: number, readerId: number): Promise<void> {
    return this.chatMessageRepository.markRoomAsRead(chatRoomId, readerId);
  }
}
