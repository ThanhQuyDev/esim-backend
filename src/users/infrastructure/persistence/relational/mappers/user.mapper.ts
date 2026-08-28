import { FileEntity } from '../../../../../files/infrastructure/persistence/relational/entities/file.entity';
import { FileMapper } from '../../../../../files/infrastructure/persistence/relational/mappers/file.mapper';
import { RoleEntity } from '../../../../../roles/infrastructure/persistence/relational/entities/role.entity';
import { StatusEntity } from '../../../../../statuses/infrastructure/persistence/relational/entities/status.entity';
import { User } from '../../../../domain/user';
import { UserEntity } from '../entities/user.entity';
import { resolveTierSummary } from '../../../../../wallets/tier/tier.resolver';
import { AuthorProfileMapper } from '../../../../../authors/infrastructure/persistence/relational/mappers/author-profile.mapper';

export class UserMapper {
  static toDomain(raw: UserEntity): User {
    const domainEntity = new User();
    domainEntity.id = raw.id;
    domainEntity.email = raw.email;
    domainEntity.password = raw.password;
    domainEntity.hasPassword = !!raw.password;
    domainEntity.provider = raw.provider;
    domainEntity.socialId = raw.socialId;
    domainEntity.firstName = raw.firstName;
    domainEntity.lastName = raw.lastName;
    domainEntity.phoneNumber = raw.phoneNumber;
    domainEntity.lifetimeSpendVnd = Number(raw.lifetimeSpendVnd ?? 0);
    domainEntity.tierOverride = raw.tierOverride ?? null;
    domainEntity.tierOverrideReason = raw.tierOverrideReason ?? null;
    const tierSummary = resolveTierSummary(
      domainEntity.lifetimeSpendVnd,
      domainEntity.tierOverride,
    );
    domainEntity.automaticTier = tierSummary.automaticTier;
    domainEntity.membershipTier = tierSummary.membershipTier;
    domainEntity.tierSource = tierSummary.tierSource;
    domainEntity.tierBenefits = tierSummary.benefits;
    if (raw.photo) {
      domainEntity.photo = FileMapper.toDomain(raw.photo);
    }
    domainEntity.authorProfile = raw.authorProfile
      ? AuthorProfileMapper.toDomain(raw.authorProfile)
      : null;
    domainEntity.role = raw.role;
    domainEntity.status = raw.status;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    domainEntity.deletedAt = raw.deletedAt;
    return domainEntity;
  }

  static toPersistence(domainEntity: User): UserEntity {
    let role: RoleEntity | undefined = undefined;

    if (domainEntity.role) {
      role = new RoleEntity();
      role.id = Number(domainEntity.role.id);
    }

    let photo: FileEntity | undefined | null = undefined;

    if (domainEntity.photo) {
      photo = new FileEntity();
      photo.id = domainEntity.photo.id;
      photo.path = domainEntity.photo.path;
    } else if (domainEntity.photo === null) {
      photo = null;
    }

    let status: StatusEntity | undefined = undefined;

    if (domainEntity.status) {
      status = new StatusEntity();
      status.id = Number(domainEntity.status.id);
    }

    const persistenceEntity = new UserEntity();
    if (domainEntity.id && typeof domainEntity.id === 'number') {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.email = domainEntity.email;
    persistenceEntity.password = domainEntity.password;
    persistenceEntity.provider = domainEntity.provider;
    persistenceEntity.socialId = domainEntity.socialId;
    persistenceEntity.firstName = domainEntity.firstName;
    persistenceEntity.lastName = domainEntity.lastName;
    persistenceEntity.phoneNumber = domainEntity.phoneNumber ?? null;
    persistenceEntity.lifetimeSpendVnd = domainEntity.lifetimeSpendVnd ?? 0;
    persistenceEntity.tierOverride = domainEntity.tierOverride ?? null;
    persistenceEntity.tierOverrideReason =
      domainEntity.tierOverrideReason ?? null;
    persistenceEntity.photo = photo;
    persistenceEntity.role = role;
    persistenceEntity.status = status;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    persistenceEntity.deletedAt = domainEntity.deletedAt;
    return persistenceEntity;
  }
}
