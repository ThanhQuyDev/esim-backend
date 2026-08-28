import { Blog } from '../../../../domain/blog';
import { BlogEntity } from '../entities/blog.entity';
import { MiniTagMapper } from '../../../../../mini-tags/infrastructure/persistence/relational/mappers/mini-tag.mapper';
import { PlanMapper } from '../../../../../plans/infrastructure/persistence/relational/mappers/plan.mapper';
import { FaqMapper } from '../../../../../faqs/infrastructure/persistence/relational/mappers/faq.mapper';
import { AuthorProfileMapper } from '../../../../../authors/infrastructure/persistence/relational/mappers/author-profile.mapper';

export class BlogMapper {
  static toDomain(raw: BlogEntity): Blog {
    const domainEntity = new Blog();
    domainEntity.language = raw.language;
    domainEntity.publishedAt = raw.publishedAt;
    domainEntity.isPublished = raw.isPublished;
    domainEntity.author = raw.author;
    domainEntity.authorAvatar = raw.authorAvatar;
    domainEntity.authorProfileId = raw.authorProfileId ?? null;
    domainEntity.authorProfile = raw.authorProfile
      ? AuthorProfileMapper.toDomain(raw.authorProfile)
      : null;
    domainEntity.authorSlug = raw.authorProfile?.slug ?? null;
    domainEntity.authorBio = raw.authorProfile?.description ?? null;
    domainEntity.category = raw.category;
    domainEntity.parent = raw.parent;
    domainEntity.coverImage = raw.coverImage;
    domainEntity.excerpt = raw.excerpt;
    domainEntity.content = raw.content;
    domainEntity.slug = raw.slug;
    domainEntity.title = raw.title;
    domainEntity.timeRead = raw.timeRead;
    domainEntity.id = raw.id;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    domainEntity.miniTag = raw.miniTag
      ? MiniTagMapper.toDomain(raw.miniTag)
      : null;
    domainEntity.plans = raw.plans?.map((plan) => PlanMapper.toDomain(plan));
    domainEntity.faqs = raw.faqs?.map((faq) => FaqMapper.toDomain(faq));
    domainEntity.faqEnabled = raw.faqEnabled;
    domainEntity.isPopular = raw.isPopular;
    return domainEntity;
  }

  static toPersistence(domainEntity: Blog): BlogEntity {
    const persistenceEntity = new BlogEntity();
    persistenceEntity.language = domainEntity.language;
    persistenceEntity.publishedAt = domainEntity.publishedAt;
    persistenceEntity.isPublished = domainEntity.isPublished;
    persistenceEntity.author = domainEntity.author;
    persistenceEntity.authorAvatar = domainEntity.authorAvatar;
    persistenceEntity.authorProfileId =
      domainEntity.authorProfile?.id ?? domainEntity.authorProfileId ?? null;
    persistenceEntity.category = domainEntity.category;
    persistenceEntity.parent = domainEntity.parent;
    persistenceEntity.coverImage = domainEntity.coverImage;
    persistenceEntity.excerpt = domainEntity.excerpt;
    persistenceEntity.content = domainEntity.content;
    persistenceEntity.slug = domainEntity.slug;
    persistenceEntity.title = domainEntity.title;
    persistenceEntity.timeRead = domainEntity.timeRead;
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    persistenceEntity.miniTag = domainEntity.miniTag
      ? MiniTagMapper.toPersistence(domainEntity.miniTag)
      : null;
    persistenceEntity.plans = domainEntity.plans?.map((plan) =>
      PlanMapper.toPersistence(plan),
    );
    persistenceEntity.faqs = domainEntity.faqs?.map((faq) =>
      FaqMapper.toPersistence(faq),
    );
    persistenceEntity.faqEnabled = domainEntity.faqEnabled ?? false;
    persistenceEntity.isPopular = domainEntity.isPopular ?? false;
    return persistenceEntity;
  }
}
