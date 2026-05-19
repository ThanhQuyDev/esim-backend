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
    // Bug 2.3 fix — persist the admin's edits with a direct, partial UPDATE
    // statement (no merge of stale `createdAt`/`updatedAt`, no full re-save of
    // the entity). Only fields explicitly present in the payload are written,
    // so a CMS edit of `htmlBody` or `subject` is guaranteed to land in the DB.
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new Error('EmailTemplate not found');

    const partial: Partial<EmailTemplateEntity> = {};
    if (payload.name !== undefined) partial.name = payload.name;
    if (payload.subject !== undefined) partial.subject = payload.subject;
    if (payload.htmlBody !== undefined) partial.htmlBody = payload.htmlBody;
    if (payload.isActive !== undefined) partial.isActive = payload.isActive;

    if (Object.keys(partial).length > 0) {
      await this.repo.update({ id }, partial);
    }

    const fresh = await this.repo.findOne({ where: { id } });
    if (!fresh) throw new Error('EmailTemplate not found after update');
    return EmailTemplateMapper.toDomain(fresh);
  }

  async remove(id: number): Promise<void> {
    await this.repo.delete(id);
  }
}
