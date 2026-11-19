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
  /** A visitor's conversation, by the key they hold (vande-2011 #023). */
  abstract findByGuestKey(guestKey: string): Promise<NullableType<ChatRoom>>;
  abstract createForGuest(guestKey: string, ip: string): Promise<ChatRoom>;
  /**
   * The visitor signed in: their conversation becomes the account's, or is
   * folded into the one the account already has. Returns the account's room id,
   * or null when the visitor had no conversation.
   */
  abstract adoptGuestRoom(
    guestKey: string,
    userId: number,
  ): Promise<number | null>;
}
