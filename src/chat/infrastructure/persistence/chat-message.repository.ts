import { ChatMessage } from '../../domain/chat-message';
import { NullableType } from '../../../utils/types/nullable.type';

export abstract class ChatMessageRepository {
  abstract create(data: Partial<ChatMessage>): Promise<ChatMessage>;
  abstract findById(id: number): Promise<NullableType<ChatMessage>>;
  abstract findByRoomId(
    chatRoomId: number,
    page: number,
    limit: number,
  ): Promise<ChatMessage[]>;
  abstract markRoomAsRead(chatRoomId: number, senderId: number): Promise<void>;
  /** The other side's messages reached `recipientId` (vande-1411 #035). */
  abstract markRoomDelivered(
    chatRoomId: number,
    recipientId: number,
  ): Promise<number>;
  abstract countUnread(chatRoomId: number, senderId: number): Promise<number>;
  /** Unread messages written BY `senderId` — the customer, for the admin view (#032). */
  abstract countUnreadFrom(
    chatRoomId: number,
    senderId: number,
  ): Promise<number>;
  abstract findLastByRoomId(
    chatRoomId: number,
  ): Promise<NullableType<ChatMessage>>;
}
