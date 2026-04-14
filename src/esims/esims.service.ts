import {
  HttpStatus,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CreateEsimDto } from './dto/create-esim.dto';
import { UpdateEsimDto } from './dto/update-esim.dto';
import { NullableType } from '../utils/types/nullable.type';
import { FilterEsimDto, SortEsimDto } from './dto/query-esim.dto';
import { EsimRepository } from './infrastructure/persistence/esim.repository';
import { Esim } from './domain/esim';
import { IPaginationOptions } from '../utils/types/pagination-options';

@Injectable()
export class EsimsService {
  constructor(private readonly esimsRepository: EsimRepository) {}

  async create(createEsimDto: CreateEsimDto): Promise<Esim> {
    const existingByIccid = await this.esimsRepository.findByIccid(
      createEsimDto.iccid,
    );
    if (existingByIccid) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { iccid: 'iccidAlreadyExists' },
      });
    }

    return this.esimsRepository.create({
      orderItemId: createEsimDto.orderItemId ?? null,
      userId: createEsimDto.userId ?? null,
      iccid: createEsimDto.iccid,
      smdpAddress: createEsimDto.smdpAddress ?? null,
      activationCode: createEsimDto.activationCode ?? null,
      lpa: createEsimDto.lpa ?? null,
      matchId: createEsimDto.matchId ?? null,
      qrcode: createEsimDto.qrcode ?? null,
      directAppleInstallationUrl:
        createEsimDto.directAppleInstallationUrl ?? null,
      apnValue: createEsimDto.apnValue ?? null,
      isRoaming: createEsimDto.isRoaming ?? null,
      status: createEsimDto.status ?? 'available',
      dataUsed: createEsimDto.dataUsed ?? null,
      dataTotal: createEsimDto.dataTotal ?? null,
      expiresAt: createEsimDto.expiresAt ?? null,
      activatedAt: createEsimDto.activatedAt ?? null,
    });
  }

  findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterEsimDto | null;
    sortOptions?: SortEsimDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<Esim[]> {
    return this.esimsRepository.findManyWithPagination({
      filterOptions,
      sortOptions,
      paginationOptions,
    });
  }

  findById(id: Esim['id']): Promise<NullableType<Esim>> {
    return this.esimsRepository.findById(id);
  }

  findByIccid(iccid: Esim['iccid']): Promise<NullableType<Esim>> {
    return this.esimsRepository.findByIccid(iccid);
  }

  async update(
    id: Esim['id'],
    updateEsimDto: UpdateEsimDto,
  ): Promise<Esim | null> {
    if (updateEsimDto.iccid) {
      const existingByIccid = await this.esimsRepository.findByIccid(
        updateEsimDto.iccid,
      );
      if (existingByIccid && existingByIccid.id !== id) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { iccid: 'iccidAlreadyExists' },
        });
      }
    }

    return this.esimsRepository.update(id, {
      orderItemId: updateEsimDto.orderItemId,
      userId: updateEsimDto.userId,
      iccid: updateEsimDto.iccid,
      smdpAddress: updateEsimDto.smdpAddress,
      activationCode: updateEsimDto.activationCode,
      status: updateEsimDto.status,
      dataUsed: updateEsimDto.dataUsed,
      dataTotal: updateEsimDto.dataTotal,
      expiresAt: updateEsimDto.expiresAt,
      activatedAt: updateEsimDto.activatedAt,
    });
  }

  async remove(id: Esim['id']): Promise<void> {
    await this.esimsRepository.remove(id);
  }
}
