import { User } from '../../../users/domain/user';
import { NullableType } from '../../../utils/types/nullable.type';
import { Otp } from '../../domain/otp';

export abstract class OtpRepository {
  abstract create(
    data: Omit<Otp, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Otp>;

  abstract findActiveByUserId(userId: User['id']): Promise<NullableType<Otp>>;

  abstract incrementAttempts(id: Otp['id']): Promise<void>;

  abstract deleteByUserId(userId: User['id']): Promise<void>;
}
