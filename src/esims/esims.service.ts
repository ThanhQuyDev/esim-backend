import {
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CreateEsimDto } from './dto/create-esim.dto';
import { UpdateEsimDto } from './dto/update-esim.dto';
import { NullableType } from '../utils/types/nullable.type';
import { FilterEsimDto, SortEsimDto } from './dto/query-esim.dto';
import { EsimRepository } from './infrastructure/persistence/esim.repository';
import { Esim } from './domain/esim';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { AiraloService } from '../esim-providers/airalo/airalo.service';
import { EsimAccessService } from '../esim-providers/esimaccess/esimaccess.service';
import { GadgetKoreaService } from '../esim-providers/gadgetkorea/gadgetkorea.service';

export interface DataUsageResult {
  remaining: number | null;
  total: number;
  dataUsed: number;
  expiredAt: string | null;
  isUnlimited: boolean;
  status: string;
  lastUpdateTime: string | null;
}

@Injectable()
export class EsimsService {
  private readonly logger = new Logger(EsimsService.name);

  constructor(
    private readonly esimsRepository: EsimRepository,
    private readonly airaloService: AiraloService,
    private readonly esimAccessService: EsimAccessService,
    private readonly gadgetKoreaService: GadgetKoreaService,
  ) {}

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
      planId: createEsimDto.planId ?? null,
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
      esimTranNo: createEsimDto.esimTranNo ?? null,
      provider: createEsimDto.provider ?? null,
      phoneNumber: createEsimDto.phoneNumber ?? null,
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
  }): Promise<[Esim[], number]> {
    return this.esimsRepository.findManyWithPagination({
      filterOptions,
      sortOptions,
      paginationOptions,
    });
  }

  findById(id: Esim['id']): Promise<NullableType<Esim>> {
    return this.esimsRepository.findById(id);
  }

  findByIdWithRelations(id: Esim['id']): Promise<NullableType<Esim>> {
    return this.esimsRepository.findByIdWithRelations(id);
  }

  findByIccid(iccid: Esim['iccid']): Promise<NullableType<Esim>> {
    return this.esimsRepository.findByIccid(iccid);
  }

  findByOrderItemIds(orderItemIds: number[]): Promise<Esim[]> {
    return this.esimsRepository.findByOrderItemIds(orderItemIds);
  }

  findAvailableByPlanId(planId: number, limit: number): Promise<Esim[]> {
    return this.esimsRepository.findAvailableByPlanId(planId, limit);
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
      planId: updateEsimDto.planId,
      iccid: updateEsimDto.iccid,
      smdpAddress: updateEsimDto.smdpAddress,
      activationCode: updateEsimDto.activationCode,
      status: updateEsimDto.status,
      dataUsed: updateEsimDto.dataUsed,
      dataTotal: updateEsimDto.dataTotal,
      expiresAt: updateEsimDto.expiresAt,
      activatedAt: updateEsimDto.activatedAt,
      esimTranNo: updateEsimDto.esimTranNo,
      provider: updateEsimDto.provider,
      phoneNumber: updateEsimDto.phoneNumber,
    });
  }

  async remove(id: Esim['id']): Promise<void> {
    await this.esimsRepository.remove(id);
  }

  async getDataUsage(esim: Esim): Promise<DataUsageResult> {
    if (esim.provider === 'airalo') {
      try {
        const usage = await this.airaloService.getDataUsage(esim.iccid);
        const result: DataUsageResult = {
          remaining: usage.remaining,
          total: usage.total,
          dataUsed: usage.total - usage.remaining,
          expiredAt: usage.expired_at,
          isUnlimited: usage.is_unlimited,
          status: usage.status,
          lastUpdateTime: null,
        };
        await this.esimsRepository.update(esim.id, {
          dataUsed: String(result.dataUsed),
          dataTotal: String(result.total),
        });
        return result;
      } catch {
        return this.fallbackFromDb(esim);
      }
    }

    if (esim.provider === 'esimaccess') {
      if (!esim.esimTranNo) {
        throw new NotFoundException('esimTranNo not found for this eSIM');
      }
      try {
        const usage = await this.esimAccessService.getDataUsage(
          esim.esimTranNo,
        );
        const bytesToMb = (bytes: number) =>
          Math.round((bytes / (1024 * 1024)) * 100) / 100;
        const result: DataUsageResult = {
          remaining: bytesToMb(usage.totalData - usage.dataUsage),
          total: bytesToMb(usage.totalData),
          dataUsed: bytesToMb(usage.dataUsage),
          expiredAt: null,
          isUnlimited: false,
          status: 'ACTIVE',
          lastUpdateTime: usage.lastUpdateTime,
        };
        await this.esimsRepository.update(esim.id, {
          dataUsed: String(result.dataUsed),
          dataTotal: String(result.total),
        });
        return result;
      } catch {
        return this.fallbackFromDb(esim);
      }
    }

    if (esim.provider === 'gadgetkorea') {
      // For gadgetkorea, the topupId is stored as orderRequestId in order-item
      // We need to find the order-item associated with this esim
      const esimWithRelations =
        await this.esimsRepository.findByIdWithRelations(esim.id);
      const orderRequestId =
        (esimWithRelations as any)?.orderItem?.orderRequestId ?? null;
      if (!orderRequestId) {
        throw new NotFoundException(
          'orderRequestId (topupId) not found for this eSIM',
        );
      }
      try {
        const usage =
          await this.gadgetKoreaService.getDataUsage(orderRequestId);
        const dataUsedMb = parseFloat(usage.usage) || 0;
        const result: DataUsageResult = {
          remaining: null,
          total: 0,
          dataUsed: dataUsedMb,
          expiredAt: usage.expireTime || null,
          isUnlimited: false,
          status: usage.activeTime ? 'ACTIVE' : 'INACTIVE',
          lastUpdateTime: null,
        };
        await this.esimsRepository.update(esim.id, {
          dataUsed: String(result.dataUsed),
        });
        return result;
      } catch {
        return this.fallbackFromDb(esim);
      }
    }

    throw new NotFoundException('Provider not supported or not set');
  }

  private fallbackFromDb(esim: Esim): DataUsageResult {
    const total = esim.dataTotal ? parseFloat(esim.dataTotal) : 0;
    const dataUsed = esim.dataUsed ? parseFloat(esim.dataUsed) : 0;
    return {
      remaining: total - dataUsed,
      total,
      dataUsed,
      expiredAt: null,
      isUnlimited: false,
      status: esim.status ?? 'UNKNOWN',
      lastUpdateTime: null,
    };
  }

  /**
   * Soft-delete sold eSIMs older than 6 months to free resources.
   * Runs daily at 2:00 AM.
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupSoldEsims(): Promise<void> {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const deleted = await this.esimsRepository.softDeleteByStatusOlderThan(
      'sold',
      sixMonthsAgo,
    );

    if (deleted > 0) {
      this.logger.log(`Cleaned up ${deleted} sold eSIMs older than 6 months`);
    }
  }
}
