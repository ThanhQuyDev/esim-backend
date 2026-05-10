import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { PlansService } from './plans.service';
import { DestinationsService } from '../destinations/destinations.service';
import { ProfitMarginsService } from '../profit-margins/profit-margins.service';
import { ImportResult } from './plans-import.service';

const PROVIDER = 'japantravelsim';

// Column indices (1-based) matching the Japan.xlsx header:
// Group | deviceSkuId | Plan | Days | CostPrice | Data | Type | Operator | APN | APN User | APN Password | Activation Deadline | Throttled Speed | Package
const COL = {
  GROUP: 1,
  DEVICE_SKU_ID: 2,
  PLAN: 3,
  DAYS: 4,
  COST_PRICE: 5,
  DATA: 6,
  TYPE: 7,
  OPERATOR: 8,
  APN: 9,
  // APN_USER: 10,       // skipped
  // APN_PASSWORD: 11,   // skipped
  // ACTIVATION: 12,     // skipped
  THROTTLED_SPEED: 13,
  PACKAGE: 14,
};

@Injectable()
export class PlansJapantravelsimImportService {
  private readonly logger = new Logger(PlansJapantravelsimImportService.name);

  constructor(
    private readonly plansService: PlansService,
    private readonly destinationsService: DestinationsService,
    private readonly profitMarginsService: ProfitMarginsService,
  ) {}

  async importFromExcel(
    fileBuffer: Buffer,
  ): Promise<ImportResult & { updated: number }> {
    const workbook = new Workbook();
    await workbook.xlsx.load(fileBuffer as any);

    const ws = workbook.worksheets[0];
    if (!ws) {
      throw new BadRequestException('No worksheet found in the Excel file');
    }

    const result: ImportResult & { updated: number } = {
      total: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    // Resolve Japan destination
    const japanDestination = await this.resolveJapanDestination();

    // Deactivate all existing japantravelsim plans before import
    await this.plansService.deactivateAllProviderPlans(PROVIDER);

    for (let rowNum = 2; rowNum <= ws.rowCount; rowNum++) {
      const row = ws.getRow(rowNum);
      if (this.isEmptyRow(row)) continue;

      result.total++;

      try {
        const group = this.getString(row.getCell(COL.GROUP).value);
        const deviceSkuId = this.getString(
          row.getCell(COL.DEVICE_SKU_ID).value,
        );
        const planName = this.getString(row.getCell(COL.PLAN).value);
        const days = this.getNumber(row.getCell(COL.DAYS).value);
        const costPrice =
          this.getNumber(row.getCell(COL.COST_PRICE).value) ?? 0;
        const dataStr = this.getString(row.getCell(COL.DATA).value);
        const type = this.getString(row.getCell(COL.TYPE).value) || 'unlimited';
        const operator = this.getString(row.getCell(COL.OPERATOR).value);
        const apn = this.getString(row.getCell(COL.APN).value);
        const throttledSpeed = this.getString(
          row.getCell(COL.THROTTLED_SPEED).value,
        );

        if (!group) throw new Error('Missing Group');
        if (!deviceSkuId) throw new Error('Missing deviceSkuId');
        if (!planName) throw new Error('Missing Plan name');
        if (days == null || days <= 0) throw new Error('Invalid Days');

        const providerPlanId = `${group}:${deviceSkuId}`;
        const dataMb = this.parseDataMb(dataStr);
        const slug = this.buildPlanSlug(dataMb, days!, type);
        const fupSpeed = this.parseFupSpeed(throttledSpeed);

        const planData = {
          provider: PROVIDER,
          providerPlanId,
          name: planName,
          slug,
          countryCode: 'JP',
          destinationId: japanDestination.id,
          regionId: null,
          durationDays: days,
          dataMb,
          costPrice,
          price: costPrice,
          retailPrice: costPrice,
          currency: 'USD',
          sms: null,
          call: null,
          type: type.toLowerCase(),
          topUp: false,
          speed: '5G',
          operatorName: operator || null,
          fupSpeed,
          isKyc: false,
          apn: apn || null,
          isActive: true,
        };

        const existing = await this.plansService.findBySlug(slug);
        if (existing) {
          await this.plansService.update(existing.id, planData);
          result.updated++;
        } else {
          await this.plansService.create(planData);
          result.created++;
        }
      } catch (error: any) {
        result.skipped++;
        result.errors.push({
          row: rowNum,
          error: error?.message || 'Unknown error',
        });
        this.logger.warn(`Row ${rowNum} import failed: ${error?.message}`);
      }
    }

    // Recalculate prices with profit margins, then mark cheapest and update VND
    await this.profitMarginsService.recalculateAllPlanPrices();
    await this.plansService.markCheapestPlans();
    await this.plansService.updateVndPrices();

    return result;
  }

  private async resolveJapanDestination(): Promise<{ id: number }> {
    const existing = await this.destinationsService.findByCountryCode('JP');
    if (existing) return existing;

    const byName = await this.destinationsService.findByName('Japan');
    if (byName) return byName;

    return this.destinationsService.create({
      name: 'Japan',
      slug: 'japan',
      countryCode: 'JP',
      flagUrl: null,
      isActive: true,
    });
  }

  private parseDataMb(dataStr: string | null): number {
    if (!dataStr || dataStr === 'NULL' || dataStr === 'null') return 0;

    const gbMatch = dataStr.match(/(\d+(?:\.\d+)?)\s*GB/i);
    if (gbMatch) return Math.round(parseFloat(gbMatch[1]) * 1024);

    const mbMatch = dataStr.match(/(\d+)\s*MB/i);
    if (mbMatch) return parseInt(mbMatch[1], 10);

    return 0;
  }

  private parseFupSpeed(speed: string | null): string | null {
    if (!speed) return null;
    return speed; // e.g. "max speed", "128Kbps", "10 Mbps"
  }

  private buildPlanSlug(dataMb: number, days: number, type: string): string {
    const prefix = PROVIDER.substring(0, 2).toLowerCase(); // "ja"
    const dataLabel = dataMb >= 1024 ? `${dataMb / 1024}gb` : `${dataMb}mb`;
    const dataPart = dataMb > 0 ? `-${dataLabel}` : '';
    return `japan${dataPart}-${days}days-${type.toLowerCase()}-${prefix}`;
  }

  private getString(value: any): string | null {
    if (value == null) return null;
    if (typeof value === 'object' && 'text' in value) return value.text;
    if (typeof value === 'object' && 'result' in value)
      return String(value.result);
    return String(value).trim() || null;
  }

  private getNumber(value: any): number | null {
    if (value == null) return null;
    if (typeof value === 'object' && 'result' in value) value = value.result;
    const num = Number(value);
    return isNaN(num) ? null : num;
  }

  private isEmptyRow(row: any): boolean {
    for (let col = 1; col <= 5; col++) {
      const val = row.getCell(col).value;
      if (val != null && String(val).trim() !== '') return false;
    }
    return true;
  }
}
