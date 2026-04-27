import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailTemplateEntity } from '../entities/email-template.entity';
import { EmailTemplateRepository } from '../../email-template.repository';
import { EmailTemplateMapper } from '../mappers/email-template.mapper';
import { EmailTemplate } from '../../../../domain/email-template';
import { NullableType } from '../../../../../utils/types/nullable.type';

@Injectable()
export class EmailTemplatesRelationalRepository implements EmailTemplateRepository {
  constructor(
    @InjectRepository(EmailTemplateEntity)
    private readonly repo: Repository<EmailTemplateEntity>,
  ) {}

  async create(
    data: Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<EmailTemplate> {
    const entity = await this.repo.save(
      this.repo.create(
        EmailTemplateMapper.toPersistence(data as EmailTemplate),
      ),
    );
    return EmailTemplateMapper.toDomain(entity);
  }

  async findAll(): Promise<EmailTemplate[]> {
    const entities = await this.repo.find({ order: { createdAt: 'DESC' } });
    return entities.map(EmailTemplateMapper.toDomain);
  }

  async findById(id: number): Promise<NullableType<EmailTemplate>> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? EmailTemplateMapper.toDomain(entity) : null;
  }

  async findByName(name: string): Promise<NullableType<EmailTemplate>> {
    const entity = await this.repo.findOne({ where: { name } });
    return entity ? EmailTemplateMapper.toDomain(entity) : null;
  }

  async update(
    id: number,
    payload: Partial<EmailTemplate>,
  ): Promise<EmailTemplate> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new Error('EmailTemplate not found');
    const updated = await this.repo.save(
      this.repo.create(
        EmailTemplateMapper.toPersistence({
          ...EmailTemplateMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );
    return EmailTemplateMapper.toDomain(updated);
  }

  async remove(id: number): Promise<void> {
    await this.repo.delete(id);
  }
}
