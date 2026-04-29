import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { ChatMessageEntity } from '../entities/chat-message.entity';
import { ChatMessageRepository } from '../../chat-message.repository';
import { ChatMessageMapper } from '../mappers/chat-message.mapper';
import { ChatMessage } from '../../../../domain/chat-message';
import { NullableType } from '../../../../../utils/types/nullable.type';

@Injectable()
export class ChatMessageRelationalRepository implements ChatMessageRepository {
  constructor(
    @InjectRepository(ChatMessageEntity)
    private readonly repo: Repository<ChatMessageEntity>,
  ) {}

  async create(data: Partial<ChatMessage>): Promise<ChatMessage> {
    const entity = this.repo.create({
      chatRoomId: data.chatRoomId,
      senderId: data.senderId,
      message: data.message,
      isRead: false,
    });
    const saved = await this.repo.save(entity);
    return ChatMessageMapper.toDomain(saved);
  }

  async findByRoomId(
    chatRoomId: number,
    page: number,
    limit: number,
  ): Promise<ChatMessage[]> {
    const entities = await this.repo.find({
      where: { chatRoomId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return entities.map(ChatMessageMapper.toDomain);
  }

  async markRoomAsRead(chatRoomId: number, senderId: number): Promise<void> {
    await this.repo.update(
      { chatRoomId, isRead: false, senderId: Not(senderId) },
      { isRead: true },
    );
  }

  async countUnread(chatRoomId: number, senderId: number): Promise<number> {
    return this.repo.count({
      where: { chatRoomId, isRead: false, senderId: Not(senderId) },
    });
  }

  async findLastByRoomId(
    chatRoomId: number,
  ): Promise<NullableType<ChatMessage>> {
    const entity = await this.repo.findOne({
      where: { chatRoomId },
      order: { createdAt: 'DESC' },
    });
    return entity ? ChatMessageMapper.toDomain(entity) : null;
  }
}
