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

      const iccid = this.cellStr(row.getCell(col('iccid') ?? 20).value) ?? '';
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

        // Extract plan fields from new column structure
        // 1:Country, 2:Country Code, 3:Plan ID, 4:Name, 5:Data, 6:Days, 7:Type,
        // 8:Expried Time, 9:Carrier, 10:Network, 11:Throttled Speed, 12:APN,
        // 13:Topup, 14:eKYC, 15:Hot-Spot, 16:Hot-Spot Allow, 17:Support Phone Number,
        // 18:Call, 19:SMS, 20:ICCID, 21:Phone Number, 22:LPA,
        // 23:SMDP Address, 24:Activation code, 25:Cost Price, 26:Sell Price
        const rowCountryCode =
          this.cellStr(row.getCell(col('country code') ?? 2).value) ??
          countryCode;
        const providerPlanId =
          this.cellStr(row.getCell(col('plan id') ?? 3).value) ?? '';
        const planName =
          this.cellStr(row.getCell(col('name') ?? 4).value) ?? '';
        const dataRaw = this.cellStr(row.getCell(col('data') ?? 5).value) ?? '';
        const dataMb = this.parseDataToMb(dataRaw);
        const durationDays =
          this.cellNum(row.getCell(col('days') ?? 6).value) ?? 0;
        const type =
          this.cellStr(row.getCell(col('type') ?? 7).value) ?? 'daily';

        // Expired time
        const expiredTimeRaw = row.getCell(col('expried time') ?? 8).value;
        const expiresAt = this.parseDate(expiredTimeRaw);

        const operatorName = this.cellStr(
          row.getCell(col('carrier') ?? 9).value,
        );
        const speed = this.cellStr(row.getCell(col('network') ?? 10).value);
        const fupSpeed = this.cellStr(
          row.getCell(col('throttled speed') ?? 11).value,
        );
        const apnValue = this.cellStr(row.getCell(col('apn') ?? 12).value);
        const topUpRaw = this.cellStr(row.getCell(col('topup') ?? 13).value);
        const topUp = this.parseVietnameseBoolean(topUpRaw);
        const isKycRaw = this.cellStr(row.getCell(col('ekyc') ?? 14).value);
        const isKyc = this.parseVietnameseBoolean(isKycRaw);

        // Hot-Spot fields
        const hotSpotRaw = this.cellStr(
          row.getCell(col('hot-spot') ?? 15).value,
        );
        const hotSpot = this.parseVietnameseBoolean(hotSpotRaw);
        const hotSpotAllow =
          this.cellStr(row.getCell(col('hot-spot allow') ?? 16).value) ?? null;

        // Support Phone Number, Call, SMS
        const callRaw = this.cellStr(row.getCell(col('call') ?? 18).value);
        const call = this.parseVietnameseBoolean(callRaw) ? 1 : null;
        const smsRaw = this.cellStr(row.getCell(col('sms') ?? 19).value);
        const sms = this.parseVietnameseBoolean(smsRaw) ? 1 : null;

        const costPrice =
          this.cellNum(row.getCell(col('cost price') ?? 25).value) ?? 0;
        const sellPrice =
          this.cellNum(row.getCell(col('sell price') ?? 26).value) ?? 0;
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
                countryCode: rowCountryCode,
                destinationId,
                durationDays,
                dataMb,
                costPrice,
                price,
                retailPrice: sellPrice,
                currency: 'VND',
                type: type.toLowerCase(),
                operatorName: operatorName ?? undefined,
                speed: speed ?? undefined,
                fupSpeed: fupSpeed ?? undefined,
                apn: apnValue ?? undefined,
                topUp,
                isKyc,
                hotSpot,
                hotSpotAllow,
                sms,
                call,
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
          row.getCell(col('phone number') ?? 21).value,
        );
        const lpa = this.cellStr(row.getCell(col('lpa') ?? 22).value);

        // Auto-extract SMDP Address and Activation Code from LPA
        // LPA format: LPA:1$<smdpAddress>$<activationCode>
        // SMDP Address = value between the first $ and second $ in LPA
        // Activation Code = value after the last $ in LPA
        let smdpAddress: string | null = null;
        let activationCode: string | null = null;

        if (lpa) {
          smdpAddress = this.extractSmdpFromLpa(lpa);
          activationCode = this.extractActivationCodeFromLpa(lpa);
        }

        await this.esimRepository.create({
          iccid,
          phoneNumber: phoneNumber ?? null,
          lpa: lpa ?? null,
          smdpAddress,
          activationCode,
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

  /**
   * Extract SMDP Address from LPA code.
   * LPA format: LPA:1$<smdpAddress>$<activationCode>
   * Returns the value between the first $_$ (i.e. between first and second $).
   */
  private extractSmdpFromLpa(lpa: string): string | null {
    const parts = lpa.split('$');
    // parts[0] = "LPA:1", parts[1] = smdpAddress, parts[2] = activationCode
    if (parts.length >= 2 && parts[1]) {
      return parts[1];
    }
    return null;
  }

  /**
   * Extract Activation Code from LPA code.
   * Returns the value after the last $ in the LPA string.
   */
  private extractActivationCodeFromLpa(lpa: string): string | null {
    const lastDollarIndex = lpa.lastIndexOf('$');
    if (lastDollarIndex >= 0 && lastDollarIndex < lpa.length - 1) {
      return lpa.substring(lastDollarIndex + 1);
    }
    return null;
  }

  /**
   * Parse Vietnamese boolean values: "Có" = true, "Không" = false, "O" = true, "X" = false
   */
  private parseVietnameseBoolean(value: string | null): boolean {
    if (!value) return false;
    const lower = value.trim().toLowerCase();
    return (
      lower === 'có' ||
      lower === 'co' ||
      lower === 'yes' ||
      lower === 'true' ||
      lower === '1' ||
      lower === 'o'
    );
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
