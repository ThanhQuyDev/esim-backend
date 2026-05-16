import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { EsimRepository } from './infrastructure/persistence/esim.repository';
import { PlansService } from '../plans/plans.service';
import { PlanRepository } from '../plans/infrastructure/persistence/plan.repository';
import { DestinationsService } from '../destinations/destinations.service';

export interface EsimImportResult {
  total: number;
  created: number;
  skipped: number;
  planCreated: number;
  errors: Array<{ row: number; iccid: string; error: string }>;
}

@Injectable()
export class EsimsImportService {
  private readonly logger = new Logger(EsimsImportService.name);

  constructor(
    private readonly esimRepository: EsimRepository,
    private readonly plansService: PlansService,
    private readonly planRepository: PlanRepository,
    private readonly destinationsService: DestinationsService,
  ) {}

  async importFromExcel(
    fileBuffer: Buffer,
    provider: string,
    countryCode: string,
    sheetIdentifier?: string,
  ): Promise<EsimImportResult> {
    const workbook = new Workbook();
    await workbook.xlsx.load(fileBuffer as any);

    const worksheet = sheetIdentifier
      ? (workbook.getWorksheet(sheetIdentifier) ??
        workbook.worksheets[Number(sheetIdentifier)] ??
        workbook.worksheets[0])
      : workbook.worksheets[0];

    if (!worksheet) {
      throw new BadRequestException('Worksheet not found');
    }

    // Build header map from row 1
    const headerRow = worksheet.getRow(1);
    const headerMap = new Map<string, number>();
    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const val = this.cellStr(cell.value);
      if (val) headerMap.set(val.trim().toLowerCase(), colNumber);
    });

    const col = (name: string) => headerMap.get(name.toLowerCase());

    const result: EsimImportResult = {
      total: 0,
      created: 0,
      skipped: 0,
      planCreated: 0,
      errors: [],
    };

    // Resolve destinationId from countryCode
    let destinationId: number | null = null;
    const destination =
      await this.destinationsService.findByCountryCode(countryCode);
    if (destination) {
      destinationId = destination.id;
    }

    // Cache plans created/found during this import to avoid repeated DB calls
    const planCache = new Map<string, number>();

    for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum++) {
      const row = worksheet.getRow(rowNum);

      let isEmpty = true;
      row.eachCell({ includeEmpty: false }, () => {
        isEmpty = false;
      });
      if (isEmpty) continue;

      result.total++;

      const iccid = this.cellStr(row.getCell(col('iccid') ?? 2).value) ?? '';
      if (!iccid) {
        result.skipped++;
        result.errors.push({ row: rowNum, iccid: '', error: 'ICCID is empty' });
        continue;
      }

      try {
        // Check duplicate iccid
        const existing = await this.esimRepository.findByIccid(iccid);
        if (existing) {
          result.skipped++;
          result.errors.push({
            row: rowNum,
            iccid,
            error: 'ICCID already exists',
          });
          continue;
        }

        // Extract type from Excel column
        const type =
          this.cellStr(row.getCell(col('type') ?? 8).value) ?? 'data-in-total';

        // Extract expiredTime from Excel column
        const expiredTimeRaw = row.getCell(col('expried time') ?? 6).value;
        const expiresAt = this.parseDate(expiredTimeRaw);

        // Extract plan fields — use fixed column indices to avoid duplicate header issues
        const providerPlanId =
          this.cellStr(row.getCell(col('code') ?? 9).value) ?? '';
        const planName =
          this.cellStr(row.getCell(col('name') ?? 4).value) ?? '';
        const durationDays = this.cellNum(row.getCell(13).value) ?? 0; // col 13: Days (plan days)
        const dataRaw = this.cellStr(row.getCell(12).value) ?? ''; // col 12: Data (e.g. "5GB")
        const dataMb = this.parseDataToMb(dataRaw);
        const operatorName = this.cellStr(
          row.getCell(col('carrier') ?? 14).value,
        );
        const speed = this.cellStr(row.getCell(col('network') ?? 15).value);
        const costPrice = this.cellNum(row.getCell(25).value) ?? 0; // col 25: Cost Price
        const sellPrice = this.cellNum(row.getCell(26).value) ?? 0; // col 26: Sell Price
        // During import, set price = costPrice (no profit).
        // Tier-based profit recalculation happens separately via recalculateAllPlanPrices().
        const price = costPrice;

        // Find or create plan
        const planSlug = `${provider}-${providerPlanId}`
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, '-');
        let planId: number | null = null;

        if (providerPlanId) {
          if (planCache.has(planSlug)) {
            planId = planCache.get(planSlug)!;
          } else {
            const existingPlan = await this.planRepository.findBySlug(planSlug);
            if (existingPlan) {
              planId = existingPlan.id;
              planCache.set(planSlug, planId);
            } else {
              const newPlan = await this.plansService.create({
                provider,
                providerPlanId,
                name: planName,
                slug: planSlug,
                countryCode,
                destinationId,
                durationDays,
                dataMb,
                costPrice,
                price,
                retailPrice: sellPrice,
                currency: 'VND',
                type,
                operatorName: operatorName ?? undefined,
                speed: speed ?? undefined,
                isActive: true,
                isLocalInventory: true,
                vndPrice: price,
              });
              planId = newPlan.id;
              planCache.set(planSlug, planId);
              result.planCreated++;
            }
          }
        }

        // Extract esim fields
        const phoneNumber = this.cellStr(
          row.getCell(col('phone number') ?? 3).value,
        );
        const lpa = this.cellStr(row.getCell(col('lpa') ?? 5).value);
        const smdpAddress = this.cellStr(
          row.getCell(col('smdp address') ?? 22).value,
        );
        const apnValue = this.cellStr(row.getCell(col('apn') ?? 23).value);
        const activationCode = this.cellStr(row.getCell(24).value); // col 24: Activation code

        await this.esimRepository.create({
          iccid,
          phoneNumber: phoneNumber ?? null,
          lpa: lpa ?? null,
          smdpAddress: smdpAddress ?? null,
          activationCode: activationCode ?? null,
          provider,
          planId: planId ?? null,
          orderItemId: null,
          userId: null,
          matchId: null,
          qrcode: null,
          directAppleInstallationUrl: null,
          apnValue: apnValue ?? null,
          isRoaming: null,
          status: 'available',
          dataUsed: null,
          dataTotal: dataMb ? String(dataMb) : null,
          expiresAt: expiresAt,
          activatedAt: null,
          esimTranNo: null,
        });

        result.created++;
      } catch (error: any) {
        result.skipped++;
        result.errors.push({
          row: rowNum,
          iccid,
          error: error?.message ?? 'Unknown error',
        });
        this.logger.warn(`Row ${rowNum} (${iccid}) failed: ${error?.message}`);
      }
    }

    return result;
  }

  private cellStr(value: any): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'object' && 'text' in value) return value.text;
    if (typeof value === 'object' && 'result' in value)
      return String(value.result);
    return String(value).trim() || null;
  }

  private cellNum(value: any): number | null {
    if (value === null || value === undefined) return null;
    const n = Number(value);
    return isNaN(n) ? null : n;
  }

  private parseDataToMb(raw: string): number {
    if (!raw) return 0;
    const lower = raw.toLowerCase();
    const match = lower.match(/([\d.]+)\s*(gb|mb)/);
    if (!match) return 0;
    const num = parseFloat(match[1]);
    return match[2] === 'gb' ? Math.round(num * 1024) : Math.round(num);
  }

  private parseDate(value: any): Date | null {
    if (value === null || value === undefined) return null;
    // ExcelJS may return a Date object directly
    if (value instanceof Date) return value;
    // Handle Excel serial number (days since 1899-12-30)
    if (typeof value === 'number') {
      // Convert Excel serial date to JS Date
      // Excel epoch is 1899-12-30, Unix epoch is 1970-01-01 = 25569 days difference
      const msPerDay = 86400 * 1000;
      return new Date((value - 25569) * msPerDay);
    }
    // Handle string dates like "2026-11-06"
    const str =
      typeof value === 'object' && 'text' in value
        ? value.text
        : String(value).trim();
    if (!str) return null;
    const parsed = new Date(str);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
}
