import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { PlansService } from './plans.service';
import { DestinationsService } from '../destinations/destinations.service';
import { ImportResult } from './plans-import.service';

// Sheet name → plan type mapping

// Sheet name → plan type mapping
const SHEET_TYPE_MAP: Record<string, string> = {
  'Daily Unlimited': 'daily-limit-speed-reduced',
  'Pay-as-you-go': 'data-in-total',
  'Real Unlimited': 'daily-unlimited',
};

// Columns are fixed for all 3 sheets after user normalized them
const COL = {
  PLAN: 2, // Country name
  DAY: 3, // e.g. "7Days"
  DATA: 4, // e.g. "1GB", "500MB", "Real Unlimited"
  OPTION_NAME: 5,
  CARRIER: 6, // e.g. "Viettel/Mobifone"
  NETWORK: 7, // e.g. "4G/LTE"
  TOP_UP: 13, // "O" = true, "X" = false
  OPTION_ID: 17, // providerPlanId
  NORMAL_PRICE: 18,
  MIN_SELL_PRICE: 19,
  B2B_PRICE: 20,
};

@Injectable()
export class PlansEsimvnImportService {
  private readonly logger = new Logger(PlansEsimvnImportService.name);

  constructor(
    private readonly plansService: PlansService,
    private readonly destinationsService: DestinationsService,
  ) {}

  async importFromExcel(
    fileBuffer: Buffer,
    provider: string,
    sheets?: string[],
  ): Promise<
    ImportResult & { updated: number; destinationNotFound: string[] }
  > {
    const workbook = new Workbook();
    await workbook.xlsx.load(fileBuffer as any);

    const result: ImportResult & {
      updated: number;
      destinationNotFound: string[];
    } = {
      total: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
      destinationNotFound: [],
    };

    // Cache destination lookups to avoid N+1 queries
    const destinationCache = new Map<string, number | null>();
    const notFoundNames = new Set<string>();

    const allSheetNames = workbook.worksheets.map((ws) => ws.name);
    this.logger.log(`Sheets found in file: ${JSON.stringify(allSheetNames)}`);

    const targetSheets = workbook.worksheets.filter((ws) => {
      const name = ws.name;
      if (!SHEET_TYPE_MAP[name]) return false;
      if (sheets && sheets.length > 0) return sheets.includes(name);
      return true;
    });

    if (targetSheets.length === 0) {
      throw new BadRequestException(
        `No matching sheets found. Sheets in file: ${JSON.stringify(allSheetNames)}. Expected one of: ${Object.keys(SHEET_TYPE_MAP).join(', ')}`,
      );
    }

    for (const ws of targetSheets) {
      const planType = SHEET_TYPE_MAP[ws.name];
      this.logger.log(`Importing sheet "${ws.name}" as type "${planType}"`);

      for (let rowNum = 2; rowNum <= ws.rowCount; rowNum++) {
        const row = ws.getRow(rowNum);
        if (this.isEmptyRow(row)) continue;

        result.total++;

        try {
          const countryName = this.getString(row.getCell(COL.PLAN).value);
          if (!countryName)
            throw new Error('Missing country name in Plan column');

          // Resolve destinationId by country name (cached)
          let destinationId: number | null = null;
          if (destinationCache.has(countryName)) {
            destinationId = destinationCache.get(countryName)!;
          } else {
            const dest = await this.destinationsService.findByName(countryName);
            destinationId = dest?.id ?? null;
            destinationCache.set(countryName, destinationId);
            if (!destinationId) notFoundNames.add(countryName);
          }

          const providerPlanId =
            this.getString(row.getCell(COL.OPTION_ID).value) || '';
          if (!providerPlanId) throw new Error('Missing Option ID');

          const optionName =
            this.getString(row.getCell(COL.OPTION_NAME).value) || '';
          const durationDays = this.parseDays(
            this.getString(row.getCell(COL.DAY).value),
          );
          // Real Unlimited sheet has no data cap — force 0 instead of reading the column
          const dataGb =
            planType === 'daily-unlimited'
              ? 0
              : this.parseDataGb(this.getString(row.getCell(COL.DATA).value));
          const topUp = this.parseOX(
            this.getString(row.getCell(COL.TOP_UP).value),
          );
          const costPrice =
            this.getNumber(row.getCell(COL.B2B_PRICE).value) ?? 0;
          const price =
            this.getNumber(row.getCell(COL.MIN_SELL_PRICE).value) ?? 0;
          const retailPrice =
            this.getNumber(row.getCell(COL.NORMAL_PRICE).value) ?? 0;

          const speed = this.getString(row.getCell(COL.NETWORK).value) || null;
          const carrier = this.getString(row.getCell(COL.CARRIER).value);
          const operatorName = carrier ? carrier.replace(/\//g, ',') : null;

          const slug = this.buildPlanSlug(
            countryName,
            dataGb,
            durationDays,
            provider,
            planType,
          );

          const planData = {
            provider,
            providerPlanId,
            name: optionName || `${countryName} ${optionName}`,
            slug,
            countryCode: null,
            destinationId,
            regionId: null,
            durationDays,
            dataGb,
            costPrice,
            price,
            retailPrice,
            currency: 'USD',
            sms: null,
            call: null,
            type: planType,
            topUp,
            speed,
            operatorName,
            isActive: true,
          };

          // Upsert: update if slug exists, create if not
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
          this.logger.warn(
            `Sheet "${ws.name}" row ${rowNum}: ${error?.message}`,
          );
        }
      }
    }

    await this.plansService.markCheapestPlans();

    result.destinationNotFound = [...notFoundNames];
    return result;
  }

  private buildPlanSlug(
    locationName: string,
    dataGb: number,
    days: number,
    provider: string,
    type: string,
  ): string {
    const name = locationName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    const prefix = provider.substring(0, 2).toLowerCase();
    const dataPart = dataGb > 0 ? `-${dataGb}gb` : '';
    const unlimitedPart =
      type === 'daily-unlimited' || type === 'daily-limit-speed-reduced'
        ? '-unlimited'
        : '';
    return `${name}${dataPart}-${days}days${unlimitedPart}-${prefix}`;
  }

  // "7Days" → 7, "1Days" → 1
  private parseDays(value: string | null): number {
    if (!value) return 0;
    const match = value.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  // "1GB" → 1, "500MB" → 0.5, "Real Unlimited" → 0 (unlimited)
  private parseDataGb(value: string | null): number {
    if (!value) return 0;
    const gbMatch = value.match(/^([\d.]+)\s*GB/i);
    if (gbMatch) return parseFloat(gbMatch[1]);
    const mbMatch = value.match(/^([\d.]+)\s*MB/i);
    if (mbMatch) return parseFloat(mbMatch[1]) / 1024;
    return 0; // "Real Unlimited" or unknown
  }

  // "O" → true, "X" → false
  private parseOX(value: string | null): boolean {
    return value?.trim().toUpperCase() === 'O';
  }

  private getString(value: any): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'object' && 'result' in value)
      return String(value.result);
    if (typeof value === 'object' && 'text' in value) return value.text;
    return String(value);
  }

  private getNumber(value: any): number | null {
    if (value === null || value === undefined) return null;
    const v =
      typeof value === 'object' && 'result' in value ? value.result : value;
    const n = Number(v);
    return isNaN(n) ? null : n;
  }

  private isEmptyRow(row: any): boolean {
    let empty = true;
    row.eachCell({ includeEmpty: false }, () => {
      empty = false;
    });
    return empty;
  }
}
