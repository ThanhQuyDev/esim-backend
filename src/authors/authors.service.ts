import {
  HttpStatus,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AuthorProfile } from './domain/author-profile';
import { AuthorProfileDto } from './dto/author-profile.dto';
import { AuthorProfileRepository } from './infrastructure/persistence/relational/repositories/author-profile.repository';

@Injectable()
export class AuthorsService {
  constructor(private readonly repository: AuthorProfileRepository) {}

  findByUserId(userId: number): Promise<AuthorProfile | null> {
    return this.repository.findByUserId(userId);
  }

  findBySlug(slug: string): Promise<AuthorProfile | null> {
    return this.repository.findBySlug(this.normalizeSlug(slug));
  }

  async upsertForUser(
    userId: number,
    payload: AuthorProfileDto,
  ): Promise<AuthorProfile> {
    const slug = this.normalizeSlug(payload.slug);
    const duplicate = await this.repository.findBySlug(slug);
    if (duplicate && duplicate.userId !== userId) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { authorProfile: { slug: 'authorSlugAlreadyExists' } },
      });
    }

    const existing = await this.repository.findByUserId(userId);
    return this.repository.save({
      id: existing?.id,
      userId,
      name: payload.name.trim(),
      slug,
      avatar: payload.avatar?.trim() || null,
      description: payload.description?.trim() || null,
    } as AuthorProfile);
  }

  private normalizeSlug(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
