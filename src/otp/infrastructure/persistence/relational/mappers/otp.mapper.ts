import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';
import { UserMapper } from '../../../../../users/infrastructure/persistence/relational/mappers/user.mapper';
import { Otp } from '../../../../domain/otp';
import { OtpEntity } from '../entities/otp.entity';

export class OtpMapper {
  static toDomain(raw: OtpEntity): Otp {
    const domainEntity = new Otp();
    domainEntity.id = raw.id;
    if (raw.user) {
      domainEntity.user = UserMapper.toDomain(raw.user);
    }
    domainEntity.otpHash = raw.otpHash;
    domainEntity.expiresAt = raw.expiresAt;
    domainEntity.attempts = raw.attempts;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    return domainEntity;
  }

  static toPersistence(domainEntity: Otp): OtpEntity {
    const user = new UserEntity();
    user.id = Number(domainEntity.user.id);

    const persistenceEntity = new OtpEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.user = user;
    persistenceEntity.otpHash = domainEntity.otpHash;
    persistenceEntity.expiresAt = domainEntity.expiresAt;
    persistenceEntity.attempts = domainEntity.attempts;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    return persistenceEntity;
  }
}
