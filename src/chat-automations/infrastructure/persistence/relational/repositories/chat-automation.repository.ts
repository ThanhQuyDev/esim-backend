import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatAutomationEntity } from '../entities/chat-automation.entity';
import { ChatAutomation } from '../../../../domain/chat-automation';
import { ChatAutomationMapper } from '../mappers/chat-automation.mapper';
import { NullableType } from '../../../../../utils/types/nullable.type';

@Injectable()
export class ChatAutomationRepository {
  constructor(
    @InjectRepository(ChatAutomationEntity)
    private readonly repo: Repository<ChatAutomationEntity>,
  ) {}

  async findAll(): Promise<ChatAutomation[]> {
    const entities = await this.repo.find({ order: { type: 'ASC' } });
    return entities.map(ChatAutomationMapper.toDomain);
  }

  async findByType(type: string): Promise<NullableType<ChatAutomation>> {
    const entity = await this.repo.findOne({ where: { type } });
    return entity ? ChatAutomationMapper.toDomain(entity) : null;
  }

  async findById(id: number): Promise<NullableType<ChatAutomation>> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? ChatAutomationMapper.toDomain(entity) : null;
  }

  async create(data: Partial<ChatAutomation>): Promise<ChatAutomation> {
    const persistence = ChatAutomationMapper.toPersistence(data);
    const newEntity = await this.repo.save(this.repo.create(persistence));
    return ChatAutomationMapper.toDomain(newEntity);
  }

  async update(
    id: number,
    data: Partial<ChatAutomation>,
  ): Promise<ChatAutomation | null> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) return null;

    Object.assign(entity, ChatAutomationMapper.toPersistence(data));
    const saved = await this.repo.save(entity);
    return ChatAutomationMapper.toDomain(saved);
  }
}
