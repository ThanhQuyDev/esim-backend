import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { PlansService } from './plans.service';
import { parseValidityDays } from './plan-activation';
import { parseDailyResetPolicy } from './plan-daily-reset';
import { DestinationsService } from '../destinations/destinations.service';
import { RegionsService } from '../regions/regions.service';
import { ImportResult } from './plans-import.service';
import { isNonHkExit } from '../esim-providers/esimaccess/esimaccess.service';

const SHEET_TYPE_MAP: Record<string, string> = {
  'Daily Unlimited': 'daily',
  'Pay-as-you-go': 'fixed',
  'Real Unlimited': 'unlimited',
};

// Column indices (1-based) of the ORIGINAL gadget-korea.xlsx header — the
// fallback when a sheet's header cannot be read (see resolveGadgetColumns):
// 1:SIM Type | 2:Plan | 3:Day | 4:Data | 5:Option Name | 6:Carrier | 7:Network |
// 8:Access Type | 9:QOS | 10:Validity | 11:APN | 12:PreInstallation |
// 13:Top-up | 14:KYC | 15:Hot-Spot | 16:Hot-Spot Allow | 17:Initialize policy |
// 18:Option ID (For API) | 19:Normal Price | 20:Min.Sell Price | 21:B2B Price
const COL = {
  SIM_TYPE: 1,
  PLAN: 2,
  DAY: 3,
  DATA: 4,
  OPTION_NAME: 5,
  CARRIER: 6,
  NETWORK: 7,
  ACCESS_TYPE: 8,
  QOS: 9,
  VALIDITY: 10,
  APN: 11,
  PRE_INSTALLATION: 12,
  TOP_UP: 13,
  KYC: 14,
  HOT_SPOT: 15,
  HOT_SPOT_ALLOW: 16,
  INITIALIZE_POLICY: 17,
  OPTION_ID: 18,
  NORMAL_PRICE: 19, // retail_price
  MIN_SELL_PRICE: 20,
  B2B_PRICE: 21, // cost_price
};

type GadgetColumns = typeof COL & {
  /** Exit IP ("HK"…), added by the 20/10/2026 price file (vande #018). */
  IP: number | null;
};

/** Header text → column key; matched with case, spaces and dots ignored. */
const HEADER_KEYS: Record<string, keyof typeof COL | 'IP'> = {
  simtype: 'SIM_TYPE',
  plan: 'PLAN',
  day: 'DAY',
  data: 'DATA',
  optionname: 'OPTION_NAME',
  carrier: 'CARRIER',
  network: 'NETWORK',
  accesstype: 'ACCESS_TYPE',
  ip: 'IP',
  qos: 'QOS',
  validity: 'VALIDITY',
  apn: 'APN',
  preinstallation: 'PRE_INSTALLATION',
  topup: 'TOP_UP',
  kyc: 'KYC',
  hotspot: 'HOT_SPOT',
  hotspotallow: 'HOT_SPOT_ALLOW',
  initializepolicy: 'INITIALIZE_POLICY',
  optionidforapi: 'OPTION_ID',
  optionid: 'OPTION_ID',
  normalprice: 'NORMAL_PRICE',
  minsellprice: 'MIN_SELL_PRICE',
  b2bprice: 'B2B_PRICE',
};

/**
 * Where each column is, read from the sheet's header row (vande #018).
 *
 * The 20/10/2026 price file put a new "IP" column in the middle, shifting
 * every column after it by one; with fixed positions the import read the
 * Initialize-policy text as the Option ID and refused every row. Columns are
 * now found by their header text, so both the old and the new file import.
 * A header that does not carry the columns the import needs falls back to the
 * original positions.
 */
export function resolveGadgetColumns(
  header: (string | null | undefined)[],
): GadgetColumns {
  const found: Partial<Record<keyof typeof COL | 'IP', number>> = {};
  header.forEach((text, index) => {
    const key =
      HEADER_KEYS[
        String(text ?? '')
          .toLowerCase()
          .replace(/[\s.()_-]/g, '')
      ];
    if (key && found[key] === undefined) found[key] = index + 1;
  });

  const required: (keyof typeof COL)[] = [
    'PLAN',
    'DAY',
    'OPTION_ID',
    'B2B_PRICE',
  ];
  if (required.some((key) => found[key] === undefined)) {
    return { ...COL, IP: null };
  }
  return { ...COL, ...found, IP: found.IP ?? null } as GadgetColumns;
}

/**
 * The APN column as one tidy list: "cmlink / internet.proximus.be  / cmhk "
 * becomes "cmlink / internet.proximus.be / cmhk" (vande #018).
 */
export function cleanGadgetApn(raw: string | null): string | null {
  if (!raw) return null;
  const parts = raw
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length ? parts.join(' / ') : null;
}

const PROVIDER = 'gadgetkorea';

/** Longest plausible provider Option ID; anything longer is prose, not an id. */
const MAX_OPTION_ID_LENGTH = 40;

/**
 * Reject a value that cannot be a provider Option ID.
 *
 * The sheet's columns have shifted before: `OPTION_ID` picked up the neighbouring
 * INITIALIZE_POLICY text ("It will be initialized 24 hours after activation."),
 * which imported cleanly and gave all 1786 plans the same unusable id. An id is
 * a short token, so a sentence-shaped value is a mis-mapped column, not data.
 */
export function assertLooksLikeOptionId(value: string): void {
  if (value.length > MAX_OPTION_ID_LENGTH || /\s/.test(value)) {
    throw new Error(
      `Option ID "${value}" is not an identifier — the Option ID column looks mis-mapped`,
    );
  }
}

@Injectable()
export class PlansGadgetkoreaImportService {
  private readonly logger = new Logger(PlansGadgetkoreaImportService.name);

  constructor(
    private readonly plansService: PlansService,
    private readonly destinationsService: DestinationsService,
    private readonly regionsService: RegionsService,
  ) {}

  async importFromExcel(
    fileBuffer: Buffer,
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

    // Every accepted Option ID, so we can tell afterwards whether the column
    // actually held ids — see the uniqueness check after the import loop.
    const optionIds: string[] = [];

    const destinationCache = new Map<string, number | null>();
    const regionCache = new Map<string, number | null>();
    const notFoundNames = new Set<string>();

    const allSheetNames = workbook.worksheets.map((ws) => ws.name);
    this.logger.log(`Sheets found in file: ${JSON.stringify(allSheetNames)}`);

    const targetSheets = workbook.worksheets.filter(
      (ws) => !!SHEET_TYPE_MAP[ws.name],
    );

    if (targetSheets.length === 0) {
      throw new BadRequestException(
        `No matching sheets found. Sheets in file: ${JSON.stringify(allSheetNames)}. Expected one of: ${Object.keys(SHEET_TYPE_MAP).join(', ')}`,
      );
    }

    await this.plansService.deactivateAllProviderPlans(PROVIDER);

    for (const ws of targetSheets) {
      const planType = SHEET_TYPE_MAP[ws.name];
      this.logger.log(`Importing sheet "${ws.name}" as type "${planType}"`);
      const header: (string | null)[] = [];
      ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
        header[col - 1] = this.getString(cell.value);
      });
      const COL = resolveGadgetColumns(header);

      for (let rowNum = 2; rowNum <= ws.rowCount; rowNum++) {
        const row = ws.getRow(rowNum);
        if (this.isEmptyRow(row)) continue;

        result.total++;

        try {
          const countryName = this.getString(row.getCell(COL.PLAN).value);
          if (!countryName)
            throw new Error('Missing country name in Plan column');

          let destinationId: number | null = null;
          let regionId: number | null = null;

          if (destinationCache.has(countryName)) {
            destinationId = destinationCache.get(countryName)!;
          } else {
            const dest = await this.destinationsService.findByName(countryName);
            destinationId = dest?.id ?? null;
            destinationCache.set(countryName, destinationId);
          }

          // If not found as destination, try as region
          if (!destinationId) {
            if (regionCache.has(countryName)) {
              regionId = regionCache.get(countryName)!;
            } else {
              const region = await this.regionsService.findByName(countryName);
              regionId = region?.id ?? null;
              regionCache.set(countryName, regionId);
            }
          }

          if (!destinationId && !regionId) {
            notFoundNames.add(countryName);
            result.skipped++;
            this.logger.warn(
              `Sheet "${ws.name}" row ${rowNum}: Skipped - destination/region not found for "${countryName}"`,
            );
            continue;
          }

          const providerPlanId =
            this.getString(row.getCell(COL.OPTION_ID).value) || '';
          if (!providerPlanId) throw new Error('Missing Option ID');
          assertLooksLikeOptionId(providerPlanId);
          optionIds.push(providerPlanId);

          const durationDays = this.parseDays(
            this.getString(row.getCell(COL.DAY).value),
          );
          const dataMb =
            planType === 'unlimited'
              ? 0
              : this.parseDataMb(this.getString(row.getCell(COL.DATA).value));
          const topUp = this.parseOX(
            this.getString(row.getCell(COL.TOP_UP).value),
          );
          const isKyc = this.parseOX(
            this.getString(row.getCell(COL.KYC).value),
          );
          const apn = cleanGadgetApn(
            this.getString(row.getCell(COL.APN).value),
          );
          // Exit IP, when the file has the column (vande #018). Older files
          // leave whatever the plan already had.
          const ipExport = COL.IP
            ? this.getString(row.getCell(COL.IP).value)?.trim() || null
            : undefined;

          // Hot-Spot field
          const hotSpotRaw = this.getString(row.getCell(COL.HOT_SPOT).value);
          const hotSpot = this.parseOX(hotSpotRaw);

          const costPrice =
            this.getNumber(row.getCell(COL.B2B_PRICE).value) ?? 0;
          const retailPrice =
            this.getNumber(row.getCell(COL.NORMAL_PRICE).value) ?? 0;
          // During import, set price = costPrice (no profit).
          // Tier-based profit recalculation happens separately via recalculateAllPlanPrices().
          const price = costPrice;

          const speed = this.getString(row.getCell(COL.NETWORK).value) || null;
          const fupSpeed = this.getString(row.getCell(COL.QOS).value) || null;
          const carrier = this.getString(row.getCell(COL.CARRIER).value);
          const operatorName = carrier ? carrier.replace(/\//g, ',') : null;

          const dailyResetPolicy = parseDailyResetPolicy(
            this.getString(row.getCell(COL.INITIALIZE_POLICY).value),
          );

          const slug = this.buildPlanSlug(
            countryName,
            dataMb,
            durationDays,
            PROVIDER,
            planType,
          );

          const planData = {
            provider: PROVIDER,
            providerPlanId,
            name: this.buildPlanName(
              countryName,
              dataMb,
              durationDays,
              planType,
            ),
            slug,
            countryCode: null,
            destinationId,
            regionId,
            durationDays,
            dataMb,
            costPrice,
            price,
            retailPrice,
            currency: 'USD',
            sms: null,
            call: null,
            type: planType,
            topUp,
            speed,
            fupSpeed,
            operatorName,
            isKyc,
            apn,
            ...(ipExport !== undefined
              ? {
                  ipExport,
                  // Same rule as esimaccess (#043): TikTok & ChatGPT work
                  // unless traffic exits via Hong Kong.
                  isNonHkIp: ipExport ? isNonHkExit({ ipExport }) : false,
                }
              : {}),
            // The Validity column is the activation window, not the usage
            // period — currently 180 days for every GadgetKorea row (#070). The
            // column was already mapped but never read until now.
            activationValidityDays: parseValidityDays(
              this.getString(row.getCell(COL.VALIDITY).value),
            ),
            // "Initialize policy" is the daily reset cycle — "reset 24h" on every
            // row today (#071). Read rather than assumed, so a future sheet that
            // says otherwise is honoured; unrecognised wording contributes no keys
            // and falls through to the supplier default in PlansService.create.
            ...(dailyResetPolicy
              ? { dailyResetPolicy, dailyResetUtcOffset: null }
              : {}),
            hotSpot,
            hotSpotAllow:
              this.getString(row.getCell(COL.HOT_SPOT_ALLOW).value) || null,
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
          this.logger.warn(
            `Sheet "${ws.name}" row ${rowNum}: ${error?.message}`,
          );
        }
      }
    }

    await this.plansService.markCheapestPlans();
    await this.plansService.updateVndPrices();

    // A correctly-mapped file gives each row its own Option ID. If almost every
    // row shares one value the sheet's columns have shifted and we just filled
    // the catalogue with an unusable provider id — topup and provisioning would
    // then fail at submit time, long after the import "succeeded".
    const distinctOptionIds = new Set(optionIds).size;
    if (optionIds.length > 1 && distinctOptionIds < optionIds.length / 2) {
      const message =
        `Option ID column looks wrong: only ${distinctOptionIds} distinct value(s) across ` +
        `${optionIds.length} rows (e.g. "${optionIds[0]}"). Check that column ` +
        `${COL.OPTION_ID} of the sheet is still Option ID.`;
      this.logger.error(message);
      result.errors.push({ row: 0, error: message });
    }

    result.destinationNotFound = [...notFoundNames];
    return result;
  }

  private buildPlanName(
    locationName: string,
    dataMb: number,
    durationDays: number,
    type: string,
  ): string {
    const dataLabel = dataMb >= 1024 ? `${dataMb / 1024}GB` : `${dataMb}MB`;
    switch (type) {
      case 'fixed':
        return `${locationName} ${dataLabel} / ${durationDays}day`;
      case 'daily':
        return `${locationName} ${dataLabel} per day`;
      case 'unlimited-reduce':
      case 'unlimited':
        return `${locationName} unlimited`;
      default:
        return `${locationName} ${dataLabel} / ${durationDays}day`;
    }
  }

  private buildPlanSlug(
    locationName: string,
    dataMb: number,
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
    const dataLabel = dataMb >= 1024 ? `${dataMb / 1024}gb` : `${dataMb}mb`;
    const dataPart = dataMb > 0 ? `-${dataLabel}` : '';
    return `${name}${dataPart}-${days}days-${type}-${prefix}`;
  }

  private parseDays(value: string | null): number {
    if (!value) return 0;
    const match = value.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  private parseDataMb(value: string | null): number {
    if (!value) return 0;
    const gbMatch = value.match(/^([\d.]+)\s*GB/i);
    if (gbMatch) return Math.round(parseFloat(gbMatch[1]) * 1024);
    const mbMatch = value.match(/^([\d.]+)\s*MB/i);
    if (mbMatch) return Math.round(parseFloat(mbMatch[1]));
    return 0;
  }

  private parseOX(value: string | null): boolean {
    return value?.trim().toUpperCase() === 'O';
  }

  private getString(value: any): string | null {
    if (value === null || value === undefined) return null;
    // A cell with mixed formatting comes as rich text: its runs joined are
    // the text (vande #018 — 21 APN cells read "[object Object]").
    if (typeof value === 'object' && Array.isArray(value.richText))
      return value.richText
        .map((run: { text?: string }) => run.text ?? '')
        .join('');
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
