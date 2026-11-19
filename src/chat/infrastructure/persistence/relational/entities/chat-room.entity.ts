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
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

@Entity({ name: 'chat_room' })
export class ChatRoomEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  /** Null for a visitor's conversation (vande-2011 #023). */
  @Index({ unique: true })
  @Column({ type: Number, nullable: true })
  userId: number | null;

  /** The visitor who holds this conversation, until they sign in (#023). */
  @Index({ unique: true })
  @Column({ type: String, length: 64, nullable: true })
  guestKey: string | null;

  /** Where a visitor's conversation was opened from, against abuse (#023). */
  @Column({ type: String, length: 64, nullable: true })
  guestIp: string | null;

  @ManyToOne(() => UserEntity, { eager: true })
  @JoinColumn({ name: 'userId' })
  user?: UserEntity;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
