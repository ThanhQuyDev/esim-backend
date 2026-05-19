import { ChatRoom } from '../../domain/chat-room';
import { NullableType } from '../../../utils/types/nullable.type';

export abstract class ChatRoomRepository {
  abstract findByUserId(userId: number): Promise<NullableType<ChatRoom>>;
  abstract findById(id: number): Promise<NullableType<ChatRoom>>;
  /**
   * Feature 5.1 — list chat rooms for the admin CMS, optionally filtered by
   * the customer's email. The repository performs a JOIN against the user
   * table and ILIKEs against `email` so admins can paste the full address or
   * just a fragment to narrow down conversations quickly.
   */
  abstract findAllWithLastMessage(filter?: {
    email?: string;
  }): Promise<ChatRoom[]>;
  abstract create(data: Partial<ChatRoom>): Promise<ChatRoom>;
}
