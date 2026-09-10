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
      fileUrl: data.fileUrl ?? null,
      fileName: data.fileName ?? null,
      fileType: data.fileType ?? null,
      fileSize: data.fileSize ?? null,
      replyToId: data.replyToId ?? null,
      isRead: false,
    });
    const saved = await this.repo.save(entity);

    // Re-read with the quote attached so the message broadcast over the socket
    // already carries what the quote block renders (#073).
    if (saved.replyToId) {
      const withQuote = await this.repo.findOne({
        where: { id: saved.id },
        relations: { replyTo: true },
      });
      if (withQuote) return ChatMessageMapper.toDomain(withQuote);
    }

    return ChatMessageMapper.toDomain(saved);
  }

  async findById(id: number): Promise<NullableType<ChatMessage>> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? ChatMessageMapper.toDomain(entity) : null;
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
      relations: { replyTo: true },
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
