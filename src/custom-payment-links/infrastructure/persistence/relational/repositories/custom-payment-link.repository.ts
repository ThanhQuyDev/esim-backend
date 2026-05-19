import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CustomPaymentLinkEntity } from '../entities/custom-payment-link.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { CustomPaymentLink } from '../../../../domain/custom-payment-link';
import { CustomPaymentLinkRepository } from '../../custom-payment-link.repository';
import { CustomPaymentLinkMapper } from '../mappers/custom-payment-link.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class CustomPaymentLinkRelationalRepository implements CustomPaymentLinkRepository {
  constructor(
    @InjectRepository(CustomPaymentLinkEntity)
    private readonly customPaymentLinkRepository: Repository<CustomPaymentLinkEntity>,
  ) {}

  async create(data: CustomPaymentLink): Promise<CustomPaymentLink> {
    const persistenceModel = CustomPaymentLinkMapper.toPersistence(data);
    const newEntity = await this.customPaymentLinkRepository.save(
      this.customPaymentLinkRepository.create(persistenceModel),
    );
    return CustomPaymentLinkMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<CustomPaymentLink[]> {
    const entities = await this.customPaymentLinkRepository.find({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
    });

    return entities.map((entity) => CustomPaymentLinkMapper.toDomain(entity));
  }

  async findById(
    id: CustomPaymentLink['id'],
  ): Promise<NullableType<CustomPaymentLink>> {
    const entity = await this.customPaymentLinkRepository.findOne({
      where: { id },
    });

    return entity ? CustomPaymentLinkMapper.toDomain(entity) : null;
  }

  async findByVirtualOrderId(
    virtualOrderId: string,
  ): Promise<NullableType<CustomPaymentLink>> {
    const entity = await this.customPaymentLinkRepository.findOne({
      where: { virtualOrderId },
    });

    return entity ? CustomPaymentLinkMapper.toDomain(entity) : null;
  }

  async findByIds(
    ids: CustomPaymentLink['id'][],
  ): Promise<CustomPaymentLink[]> {
    const entities = await this.customPaymentLinkRepository.find({
      where: { id: In(ids) },
    });

    return entities.map((entity) => CustomPaymentLinkMapper.toDomain(entity));
  }

  async update(
    id: CustomPaymentLink['id'],
    payload: Partial<CustomPaymentLink>,
  ): Promise<CustomPaymentLink> {
    const entity = await this.customPaymentLinkRepository.findOne({
      where: { id },
    });

    if (!entity) {
      throw new Error('Record not found');
    }

    const updatedEntity = await this.customPaymentLinkRepository.save(
      this.customPaymentLinkRepository.create(
        CustomPaymentLinkMapper.toPersistence({
          ...CustomPaymentLinkMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return CustomPaymentLinkMapper.toDomain(updatedEntity);
  }

  async remove(id: CustomPaymentLink['id']): Promise<void> {
    await this.customPaymentLinkRepository.delete(id);
  }
}
