import { Blog } from '../../../../domain/blog';

import { BlogEntity } from '../entities/blog.entity';

export class BlogMapper {
  static toDomain(raw: BlogEntity): Blog {
    const domainEntity = new Blog();
    domainEntity.language = raw.language;

    domainEntity.publishedAt = raw.publishedAt;

    domainEntity.isPublished = raw.isPublished;

    domainEntity.author = raw.author;

    domainEntity.tags = raw.tags;

    domainEntity.coverImage = raw.coverImage;

    domainEntity.excerpt = raw.excerpt;

    domainEntity.content = raw.content;

    domainEntity.slug = raw.slug;

    domainEntity.title = raw.title;

    domainEntity.id = raw.id;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;

    return domainEntity;
  }

  static toPersistence(domainEntity: Blog): BlogEntity {
    const persistenceEntity = new BlogEntity();
    persistenceEntity.language = domainEntity.language;

    persistenceEntity.publishedAt = domainEntity.publishedAt;

    persistenceEntity.isPublished = domainEntity.isPublished;

    persistenceEntity.author = domainEntity.author;

    persistenceEntity.tags = domainEntity.tags;

    persistenceEntity.coverImage = domainEntity.coverImage;

    persistenceEntity.excerpt = domainEntity.excerpt;

    persistenceEntity.content = domainEntity.content;

    persistenceEntity.slug = domainEntity.slug;

    persistenceEntity.title = domainEntity.title;

    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;

    return persistenceEntity;
  }
}
