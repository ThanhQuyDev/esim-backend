import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OtpEntity } from '../entities/otp.entity';
import { OtpRepository } from '../../otp.repository';
import { Otp } from '../../../../domain/otp';
import { OtpMapper } from '../mappers/otp.mapper';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { User } from '../../../../../users/domain/user';

@Injectable()
export class OtpRelationalRepository implements OtpRepository {
  constructor(
    @InjectRepository(OtpEntity)
    private readonly otpRepository: Repository<OtpEntity>,
  ) {}

  async create(
    data: Omit<Otp, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Otp> {
    const persistenceModel = OtpMapper.toPersistence(data as Otp);
    const entity = await this.otpRepository.save(
      this.otpRepository.create(persistenceModel),
    );
    return OtpMapper.toDomain(entity);
  }

  async findActiveByUserId(userId: User['id']): Promise<NullableType<Otp>> {
    const entity = await this.otpRepository.findOne({
      where: {
        user: { id: Number(userId) },
      },
      order: { createdAt: 'DESC' },
    });

    return entity ? OtpMapper.toDomain(entity) : null;
  }

  async incrementAttempts(id: Otp['id']): Promise<void> {
    await this.otpRepository.increment({ id }, 'attempts', 1);
  }

  async deleteByUserId(userId: User['id']): Promise<void> {
    await this.otpRepository.delete({
      user: { id: Number(userId) },
    });
  }
}
