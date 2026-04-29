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
  @Column({ type: Number })
  senderId: number;

  @ManyToOne(() => UserEntity, { eager: true })
  @JoinColumn({ name: 'senderId' })
  sender?: UserEntity;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: Boolean, default: false })
  isRead: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
