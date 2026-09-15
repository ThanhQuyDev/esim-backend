import { AuthorProfile } from '../../../../domain/author-profile';
import { AuthorProfileEntity } from '../entities/author-profile.entity';

export class AuthorProfileMapper {
  static toDomain(raw: AuthorProfileEntity): AuthorProfile {
    const profile = new AuthorProfile();
    profile.id = raw.id;
    profile.userId = raw.userId;
    profile.name = raw.name;
    profile.nameEn = raw.nameEn ?? null;
    profile.slug = raw.slug;
    profile.avatar = raw.avatar ?? null;
    profile.description = raw.description ?? null;
    profile.descriptionEn = raw.descriptionEn ?? null;
    return profile;
  }

  static toPersistence(profile: AuthorProfile): AuthorProfileEntity {
    const entity = new AuthorProfileEntity();
    if (profile.id) entity.id = profile.id;
    entity.userId = profile.userId;
    entity.name = profile.name;
    entity.nameEn = profile.nameEn ?? null;
    entity.slug = profile.slug;
    entity.avatar = profile.avatar ?? null;
    entity.description = profile.description ?? null;
    entity.descriptionEn = profile.descriptionEn ?? null;
    return entity;
  }
}
