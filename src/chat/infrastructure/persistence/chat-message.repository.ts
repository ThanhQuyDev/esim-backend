import { ChatMessage } from '../../domain/chat-message';
import { NullableType } from '../../../utils/types/nullable.type';

export abstract class ChatMessageRepository {
  abstract create(data: Partial<ChatMessage>): Promise<ChatMessage>;
  abstract findByRoomId(
    chatRoomId: number,
    page: number,
    limit: number,
  ): Promise<ChatMessage[]>;
  abstract markRoomAsRead(chatRoomId: number, senderId: number): Promise<void>;
  abstract countUnread(chatRoomId: number, senderId: number): Promise<number>;
  abstract findLastByRoomId(
    chatRoomId: number,
  ): Promise<NullableType<ChatMessage>>;
}
