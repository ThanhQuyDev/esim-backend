import { NullableType } from '../../../utils/types/nullable.type';
import { EmailTemplate } from '../../domain/email-template';

export abstract class EmailTemplateRepository {
  abstract create(
    data: Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<EmailTemplate>;
  abstract findAll(): Promise<EmailTemplate[]>;
  abstract findById(id: number): Promise<NullableType<EmailTemplate>>;
  abstract findByName(name: string): Promise<NullableType<EmailTemplate>>;
  abstract update(
    id: number,
    payload: Partial<EmailTemplate>,
  ): Promise<EmailTemplate>;
  abstract remove(id: number): Promise<void>;
}
