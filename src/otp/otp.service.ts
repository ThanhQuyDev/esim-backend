import { Injectable } from '@nestjs/common';
import { OtpRepository } from './infrastructure/persistence/otp.repository';
import { Otp } from './domain/otp';
import { User } from '../users/domain/user';
import { NullableType } from '../utils/types/nullable.type';

@Injectable()
export class OtpService {
  constructor(private readonly otpRepository: OtpRepository) {}

  create(data: Omit<Otp, 'id' | 'createdAt' | 'updatedAt'>): Promise<Otp> {
    return this.otpRepository.create(data);
  }

  findActiveByUserId(userId: User['id']): Promise<NullableType<Otp>> {
    return this.otpRepository.findActiveByUserId(userId);
  }

  incrementAttempts(id: Otp['id']): Promise<void> {
    return this.otpRepository.incrementAttempts(id);
  }

  deleteByUserId(userId: User['id']): Promise<void> {
    return this.otpRepository.deleteByUserId(userId);
  }
}
