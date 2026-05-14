import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { SupportedDeviceEntity } from '../entities/supported-device.entity';
import {
  SupportedDevice,
  DeviceType,
} from '../../../../domain/supported-device';
import { SupportedDeviceRepository } from '../../supported-device.repository';
import { SupportedDeviceMapper } from '../mappers/supported-device.mapper';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class SupportedDeviceRelationalRepository implements SupportedDeviceRepository {
  constructor(
    @InjectRepository(SupportedDeviceEntity)
    private readonly repo: Repository<SupportedDeviceEntity>,
  ) {}

  async create(
    data: Omit<SupportedDevice, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<SupportedDevice> {
    const newEntity = await this.repo.save(
      this.repo.create(
        SupportedDeviceMapper.toPersistence(data as SupportedDevice),
      ),
    );
    return SupportedDeviceMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
    type,
    search,
  }: {
    paginationOptions: IPaginationOptions;
    type?: DeviceType;
    search?: string;
  }): Promise<[SupportedDevice[], number]> {
    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (search) where.device = ILike(`%${search}%`);

    const [entities, count] = await this.repo.findAndCount({
      where,
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      order: { type: 'ASC', manufacturer: 'ASC', device: 'ASC' },
    });
    return [entities.map(SupportedDeviceMapper.toDomain), count];
  }

  async findGrouped(search?: string): Promise<SupportedDevice[]> {
    const where: Record<string, unknown> = {};
    if (search) where.device = ILike(`%${search}%`);

    const entities = await this.repo.find({
      where,
      order: { type: 'ASC', manufacturer: 'ASC', device: 'ASC' },
    });
    return entities.map(SupportedDeviceMapper.toDomain);
  }

  async findById(
    id: SupportedDevice['id'],
  ): Promise<NullableType<SupportedDevice>> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? SupportedDeviceMapper.toDomain(entity) : null;
  }

  async update(
    id: SupportedDevice['id'],
    payload: Partial<SupportedDevice>,
  ): Promise<SupportedDevice> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new Error('Record not found');
    const updated = await this.repo.save(
      this.repo.create(
        SupportedDeviceMapper.toPersistence({
          ...SupportedDeviceMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );
    return SupportedDeviceMapper.toDomain(updated);
  }

  async remove(id: SupportedDevice['id']): Promise<void> {
    await this.repo.delete(id);
  }
}
