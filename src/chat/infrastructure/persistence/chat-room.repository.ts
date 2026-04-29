import { ChatRoom } from '../../domain/chat-room';
import { NullableType } from '../../../utils/types/nullable.type';

export abstract class ChatRoomRepository {
  abstract findByUserId(userId: number): Promise<NullableType<ChatRoom>>;
  abstract findById(id: number): Promise<NullableType<ChatRoom>>;
  abstract findAllWithLastMessage(): Promise<ChatRoom[]>;
  abstract create(data: Partial<ChatRoom>): Promise<ChatRoom>;
}
