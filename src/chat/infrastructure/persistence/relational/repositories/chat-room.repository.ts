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

  async findAllWithLastMessage(): Promise<ChatRoom[]> {
    const entities = await this.repo.find({ order: { updatedAt: 'DESC' } });
    return entities.map(ChatRoomMapper.toDomain);
  }

  async create(data: Partial<ChatRoom>): Promise<ChatRoom> {
    const entity = this.repo.create({ userId: data.userId });
    const saved = await this.repo.save(entity);
    return ChatRoomMapper.toDomain(saved);
  }
}
