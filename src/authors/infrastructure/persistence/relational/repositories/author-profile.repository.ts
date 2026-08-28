import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthorProfile } from '../../../../domain/author-profile';
import { AuthorProfileEntity } from '../entities/author-profile.entity';
import { AuthorProfileMapper } from '../mappers/author-profile.mapper';

@Injectable()
export class AuthorProfileRepository {
  constructor(
    @InjectRepository(AuthorProfileEntity)
    private readonly repository: Repository<AuthorProfileEntity>,
  ) {}

  async findByUserId(userId: number): Promise<AuthorProfile | null> {
    const entity = await this.repository.findOne({ where: { userId } });
    return entity ? AuthorProfileMapper.toDomain(entity) : null;
  }

  async findBySlug(slug: string): Promise<AuthorProfile | null> {
    const entity = await this.repository.findOne({ where: { slug } });
    return entity ? AuthorProfileMapper.toDomain(entity) : null;
  }

  async save(profile: AuthorProfile): Promise<AuthorProfile> {
    const entity = await this.repository.save(
      this.repository.create(AuthorProfileMapper.toPersistence(profile)),
    );
    return AuthorProfileMapper.toDomain(entity);
  }
}
