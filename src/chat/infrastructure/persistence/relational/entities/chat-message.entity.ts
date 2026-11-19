import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';
import { ChatRoomEntity } from './chat-room.entity';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

@Entity({ name: 'chat_message' })
export class ChatMessageEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: Number })
  chatRoomId: number;

  @ManyToOne(() => ChatRoomEntity)
  @JoinColumn({ name: 'chatRoomId' })
  chatRoom?: ChatRoomEntity;

  @Index()
  @Column({ type: Number, nullable: true })
  senderId: number | null;

  @ManyToOne(() => UserEntity, {
    eager: true,
    nullable: true,
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'senderId' })
  sender?: UserEntity | null;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: String, nullable: true })
  fileUrl?: string | null;

  @Column({ type: String, nullable: true })
  fileName?: string | null;

  @Column({ type: String, nullable: true })
  fileType?: string | null;

  @Column({ type: 'int', nullable: true })
  fileSize?: number | null;

  /** The earlier message this one quotes, when it is a reply (#073). */
  @Index()
  @Column({ type: 'int', nullable: true })
  replyToId?: number | null;

  /**
   * Loaded explicitly (`relations: { replyTo: true }`), never eagerly — an
   * eager self-relation would walk the whole reply chain on every read.
   */
  @ManyToOne(() => ChatMessageEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'replyToId' })
  replyTo?: ChatMessageEntity | null;

  /** Written by a visitor without an account; senderId is null (#023). */
  @Column({ type: Boolean, default: false })
  fromGuest: boolean;

  @Column({ type: Boolean, default: false })
  isRead: boolean;

  /**
   * When it reached the other side's open connection: "Đã nhận" in the CMS,
   * between "Đã gửi" and "Đã xem" (vande-1411 #035).
   */
  @Column({ type: 'timestamp', nullable: true })
  deliveredAt?: Date | null;

  /**
   * Reactions, one per person: `{ "<userId>": "❤️" }` (vande-1411 #037).
   */
  @Column({ type: 'jsonb', nullable: true })
  reactions?: Record<string, string> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
