import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatRoomEntity } from '../entities/chat-room.entity';
import { ChatRoomRepository } from '../../chat-room.repository';
import { ChatRoomMapper } from '../mappers/chat-room.mapper';
import { ChatRoom } from '../../../../domain/chat-room';
import { NullableType } from '../../../../../utils/types/nullable.type';

@Injectable()
export class ChatRoomRelationalRepository implements ChatRoomRepository {
  constructor(
    @InjectRepository(ChatRoomEntity)
    private readonly repo: Repository<ChatRoomEntity>,
  ) {}

  async findByUserId(userId: number): Promise<NullableType<ChatRoom>> {
    const entity = await this.repo.findOne({ where: { userId } });
    return entity ? ChatRoomMapper.toDomain(entity) : null;
  }

  async findById(id: number): Promise<NullableType<ChatRoom>> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? ChatRoomMapper.toDomain(entity) : null;
  }

  async findAllWithLastMessage(filter?: {
    email?: string;
  }): Promise<ChatRoom[]> {
    // Feature 5.1 — pull the user inline (eager join) so the admin grid can
    // show the customer's email/name without a second round-trip. When the
    // admin types in the email filter we ILIKE against `user.email` so a
    // partial address still matches.
    const qb = this.repo
      .createQueryBuilder('room')
      .leftJoinAndSelect('room.user', 'user')
      .orderBy('room.updatedAt', 'DESC');

    if (filter?.email && filter.email.trim().length > 0) {
      qb.andWhere('user.email ILIKE :email', {
        email: `%${filter.email.trim()}%`,
      });
    }

    const entities = await qb.getMany();
    return entities.map(ChatRoomMapper.toDomain);
  }

  async findByGuestKey(guestKey: string): Promise<NullableType<ChatRoom>> {
    const entity = await this.repo.findOne({ where: { guestKey } });
    return entity ? ChatRoomMapper.toDomain(entity) : null;
  }

  async createForGuest(guestKey: string, ip: string): Promise<ChatRoom> {
    const saved = await this.repo.save(
      this.repo.create({ userId: null, guestKey, guestIp: ip.slice(0, 64) }),
    );
    return ChatRoomMapper.toDomain(saved);
  }

  async adoptGuestRoom(
    guestKey: string,
    userId: number,
  ): Promise<number | null> {
    return this.repo.manager.transaction(async (em) => {
      const guestRoom = await em.findOne(ChatRoomEntity, {
        where: { guestKey },
        // No eager user join: FOR UPDATE refuses the nullable side of it.
        loadEagerRelations: false,
        lock: { mode: 'pessimistic_write' },
      });
      if (!guestRoom) return null;
      const own = await em.findOne(ChatRoomEntity, {
        where: { userId },
        loadEagerRelations: false,
      });
      const target = own?.id ?? guestRoom.id;
      // The visitor's messages become the account's.
      await em.query(
        `UPDATE "chat_message" SET "senderId" = $1, "fromGuest" = false, "chatRoomId" = $2
          WHERE "chatRoomId" = $3 AND "fromGuest" = true`,
        [userId, target, guestRoom.id],
      );
      if (own) {
        // The rest (welcome, replies) follow into the account's conversation.
        await em.query(
          `UPDATE "chat_message" SET "chatRoomId" = $1 WHERE "chatRoomId" = $2`,
          [own.id, guestRoom.id],
        );
        await em.delete(ChatRoomEntity, { id: guestRoom.id });
        await em.update(
          ChatRoomEntity,
          { id: own.id },
          { updatedAt: new Date() },
        );
      } else {
        await em.update(
          ChatRoomEntity,
          { id: guestRoom.id },
          { userId, guestKey: null },
        );
      }
      return target;
    });
  }

  async create(data: Partial<ChatRoom>): Promise<ChatRoom> {
    const entity = this.repo.create({ userId: data.userId });
    const saved = await this.repo.save(entity);
    return ChatRoomMapper.toDomain(saved);
  }
}
