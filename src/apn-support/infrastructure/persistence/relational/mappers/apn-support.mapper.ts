import { ApnSupport } from '../../../../domain/apn-support';
import { ApnSupportEntity } from '../entities/apn-support.entity';

export class ApnSupportMapper {
  static toDomain(raw: ApnSupportEntity): ApnSupport {
    const domainEntity = new ApnSupport();
    domainEntity.apn = raw.apn;
    domainEntity.apnLabel = raw.apnLabel;
    domainEntity.tiktokIos = !!raw.tiktokIos;
    domainEntity.tiktokAndroid = !!raw.tiktokAndroid;
    domainEntity.chatGptIos = !!raw.chatGptIos;
    domainEntity.chatGptAndroid = !!raw.chatGptAndroid;
    domainEntity.geminiIos = !!raw.geminiIos;
    domainEntity.geminiAndroid = !!raw.geminiAndroid;
    domainEntity.claudeIos = !!raw.claudeIos;
    domainEntity.claudeAndroid = !!raw.claudeAndroid;
    domainEntity.note = raw.note ?? null;
    domainEntity.id = raw.id;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    return domainEntity;
  }
}
