import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { Row, Workbook } from 'exceljs';
import {
  DomesticOffer,
  offerCount,
  parseBundleType,
  parseDataPeriod,
  parseOfferDataMb,
} from '../plans/domestic-offer';
import { EsimRepository } from './infrastructure/persistence/esim.repository';
import { PlansService } from '../plans/plans.service';
import { PlanRepository } from '../plans/infrastructure/persistence/plan.repository';
import { DestinationsService } from '../destinations/destinations.service';

export interface EsimImportResult {
  total: number;
  created: number;
  skipped: number;
  planCreated: number;
  /** Existing plans whose prices were refreshed from the file. */
  planUpdated: number;
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

  /**
   * Nhập eSIM nội địa hoặc eSIM du lịch của nhà mạng trong nước từ file Excel.
   *
   * `esimKind` là thứ duy nhất phân biệt hai loại, và nó phải đến từ nút người
   * dùng bấm chứ không suy ra từ tên nhà mạng: Viettel hôm nay chỉ bán eSIM du
   * lịch, nhưng không có gì bảo đảm mai họ không bán cả gói nội địa.
   *
   * Cả hai loại đều đặt `isLocalInventory = true` — đó là hàng mình giữ và giá
   * niêm yết bằng VND. Chỉ `isDomesticEsim` khác nhau.
   */
  async importFromExcel(
    fileBuffer: Buffer,
    provider?: string,
    countryCode?: string,
    sheetIdentifier?: string,
    esimKind: 'domestic' | 'travel' = 'travel',
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

    // The header is the row that names the ICCID column. The domestic
    // template (#066) has a Vietnamese title row above the English one, so the
    // header is row 2 there — reading row 1 imported the English titles as an
    // eSIM ("ICCID" as an ICCID). Titles in any row above count as aliases.
    let headerRowNum = 1;
    for (let r = 1; r <= Math.min(3, worksheet.rowCount); r++) {
      let hasIccid = false;
      worksheet.getRow(r).eachCell({ includeEmpty: false }, (cell) => {
        if (this.cellStr(cell.value)?.trim().toLowerCase() === 'iccid')
          hasIccid = true;
      });
      // The LAST titled row wins: the Vietnamese row names "ICCID" too.
      if (hasIccid) headerRowNum = r;
    }
    const headerMap = new Map<string, number>();
    for (let r = headerRowNum; r >= 1; r--) {
      worksheet
        .getRow(r)
        .eachCell({ includeEmpty: false }, (cell, colNumber) => {
          const val = this.cellStr(cell.value)?.trim().toLowerCase();
          if (val && !headerMap.has(val)) headerMap.set(val, colNumber);
        });
    }

    // The domestic template (#066): no "Days"/"Type" columns — a plan runs for
    // a number of monthly cycles and carries minutes, first-cycle data, etc.
    const isDomesticTemplate =
      headerMap.has('bundle type') || headerMap.has('1st cycle data');
    const col = (name: string, legacyIndex?: number) =>
      headerMap.get(name.toLowerCase()) ??
      // Positions of the old travel template only; on the domestic template a
      // fixed position points at a different column.
      (isDomesticTemplate ? undefined : legacyIndex);
    const cellAt = (row: Row, name: string, legacyIndex?: number) => {
      const c = col(name, legacyIndex);
      return c ? row.getCell(c).value : null;
    };

    const result: EsimImportResult = {
      total: 0,
      created: 0,
      skipped: 0,
      planCreated: 0,
      planUpdated: 0,
      errors: [],
    };

    // Cache plans created/found during this import to avoid repeated DB calls
    const planCache = new Map<string, number>();
    // Cache destinationId lookups by country code to avoid repeated DB calls
    const destinationCache = new Map<string, number | null>();

    for (
      let rowNum = headerRowNum + 1;
      rowNum <= worksheet.rowCount;
      rowNum++
    ) {
      const row = worksheet.getRow(rowNum);

      let isEmpty = true;
      row.eachCell({ includeEmpty: false }, () => {
        isEmpty = false;
      });
      if (isEmpty) continue;

      result.total++;

      const iccid = this.cellStr(cellAt(row, 'iccid', 20)) ?? '';
      if (!iccid) {
        result.skipped++;
        result.errors.push({ row: rowNum, iccid: '', error: 'ICCID is empty' });
        continue;
      }

      try {
        // Check duplicate iccid (including soft-deleted records)
        const existing =
          await this.esimRepository.findByIccidWithDeleted(iccid);
        // An eSIM already in stock is not added again — but its row still
        // updates the plan below. Re-uploading a file to change a plan's price
        // or perks (#066) skipped every such row before reaching the plan, so
        // plans whose eSIMs were imported earlier never changed.
        const alreadyInStock = !!existing && !existing.deletedAt;

        // If a soft-deleted record exists, restore it and update with new data
        const shouldRestore = !!existing && !!existing.deletedAt;

        // Extract plan fields from new column structure
        // 1:Country, 2:Country Code, 3:Plan ID, 4:Name, 5:Data, 6:Days, 7:Type,
        // 8:Expried Time, 9:Carrier, 10:Network, 11:Throttled Speed, 12:APN,
        // 13:Topup, 14:eKYC, 15:Hot-Spot, 16:Hot-Spot Allow, 17:Support Phone Number,
        // 18:Call, 19:SMS, 20:ICCID, 21:Phone Number, 22:LPA,
        // 23:SMDP Address, 24:Activation code, 25:Cost Price, 26:Sell Price

        // Resolve country code (Country Code column overrides DTO override)
        const rowCountryCode =
          this.cellStr(cellAt(row, 'country code', 2)) ?? countryCode ?? '';
        if (!rowCountryCode) {
          result.skipped++;
          result.errors.push({
            row: rowNum,
            iccid,
            error: 'Country Code is empty',
          });
          continue;
        }

        // The carrier chosen in the import dialog wins over the file's Carrier
        // column. Admins reuse the Viettel template for other local carriers,
        // and that column still reads "Viettel", so the column used to win and
        // every row landed on the wrong provider. The column is only a fallback.
        //
        // The domestic template (#066) is the exception: one file lists iTel,
        // Wintel and VNSKY plans together, so each row's Carrier is the truth
        // and the dialog's choice only fills a blank cell.
        const dialogCarrier = provider?.trim() || null;
        const carrier = this.cellStr(cellAt(row, 'carrier', 9));
        const chosenCarrier =
          isDomesticTemplate && carrier ? carrier : dialogCarrier;
        const rowProvider = this.normalizeProvider(
          chosenCarrier ?? carrier ?? '',
        );
        if (!rowProvider) {
          result.skipped++;
          result.errors.push({
            row: rowNum,
            iccid,
            error: 'Carrier is empty',
          });
          continue;
        }

        // Resolve destinationId from per-row country code (with cache)
        // Also try Country name (column 1) as fallback for destination lookup
        const rowCountryName = this.cellStr(cellAt(row, 'country', 1)) ?? '';
        const cacheKey = rowCountryCode || rowCountryName;

        let destinationId: number | null;
        if (destinationCache.has(cacheKey)) {
          destinationId = destinationCache.get(cacheKey) ?? null;
        } else {
          // Try by country code first (normalize to uppercase for DB match)
          let destination = rowCountryCode
            ? await this.destinationsService.findByCountryCode(
                rowCountryCode.toUpperCase(),
              )
            : null;

          // Fallback: try by country name if code lookup failed
          if (!destination && rowCountryName) {
            destination =
              await this.destinationsService.findByName(rowCountryName);
          }

          destinationId = destination?.id ?? null;
          destinationCache.set(cacheKey, destinationId);

          if (!destinationId) {
            this.logger.warn(
              `Row ${rowNum}: Could not resolve destination for countryCode="${rowCountryCode}", countryName="${rowCountryName}"`,
            );
          }
        }

        const providerPlanId = this.cellStr(cellAt(row, 'plan id', 3)) ?? '';
        const planName = this.cellStr(cellAt(row, 'name', 4)) ?? '';
        const dataRaw =
          this.cellStr(cellAt(row, 'data', 5)) ??
          this.cellStr(cellAt(row, '1st cycle data')) ??
          '';
        const dataMb = this.parseDataToMb(dataRaw);
        const domesticOffer = isDomesticTemplate
          ? this.readDomesticOffer(row, cellAt)
          : undefined;
        // A domestic plan runs for whole monthly cycles (1, 3, 6, 12 months).
        const durationDays =
          this.cellNum(cellAt(row, 'days', 6)) ??
          (domesticOffer ? domesticOffer.cycleMonths * 30 : 0);
        const type =
          this.cellStr(cellAt(row, 'type', 7)) ??
          domesticOffer?.bundleType ??
          'daily';

        // Expired time
        const expiredTimeRaw = cellAt(row, 'expried time', 8);
        const expiresAt = this.parseDate(expiredTimeRaw);

        // Keep the carrier's display name as typed ("Wintel"), not its slug.
        const operatorName = chosenCarrier ?? carrier;
        const speed = this.cellStr(cellAt(row, 'network', 10));
        const fupSpeed = this.cellStr(cellAt(row, 'throttled speed', 11));
        const apnValue = this.cellStr(cellAt(row, 'apn', 12));
        const ipExport = this.cellStr(cellAt(row, 'ip'));
        const topUpRaw = this.cellStr(cellAt(row, 'topup', 13));
        const topUp = this.parseVietnameseBoolean(topUpRaw);
        const isKycRaw = this.cellStr(cellAt(row, 'ekyc', 14));
        const isKyc = this.parseVietnameseBoolean(isKycRaw);

        // Hot-Spot fields
        const hotSpotRaw = this.cellStr(cellAt(row, 'hot-spot', 15));
        const hotSpot = this.parseVietnameseBoolean(hotSpotRaw);
        const hotSpotAllow =
          this.cellStr(cellAt(row, 'hot-spot allow', 16)) ?? null;

        // Support Phone Number, Call, SMS. The domestic template has no
        // yes/no Call/SMS columns: any minutes or SMS in the offer mean yes.
        const callRaw = this.cellStr(cellAt(row, 'call', 18));
        const call =
          this.parseVietnameseBoolean(callRaw) ||
          (domesticOffer &&
            domesticOffer.offNetMinutes +
              domesticOffer.onNetMinutes +
              domesticOffer.domesticMinutes >
              0)
            ? 1
            : null;
        const smsRaw = this.cellStr(cellAt(row, 'sms', 19));
        const sms =
          this.parseVietnameseBoolean(smsRaw) ||
          (domesticOffer &&
            domesticOffer.offNetSms + domesticOffer.onNetSms > 0)
            ? 1
            : null;

        const costPrice = this.cellNum(cellAt(row, 'cost price', 25)) ?? 0;
        const sellPrice = this.cellNum(cellAt(row, 'sell price', 26)) ?? 0;
        // Base price is the cost. The margin tier is applied on top for local
        // plans: by PlansService.create for a new plan, and below when a
        // re-upload changes the cost of an existing one.
        const price = costPrice;

        // Find or create plan
        const planSlug = `${rowProvider}-${providerPlanId}`
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

              const planPatch: Record<string, unknown> = {};

              // Backfill destinationId on existing plan if it was NULL
              if (!existingPlan.destinationId && destinationId) {
                planPatch.destinationId = destinationId;
                planPatch.countryCode = rowCountryCode.toUpperCase();
              }

              // Re-upload with new prices must actually change the plan.
              // Previously only the destination was backfilled, so a price
              // change in the file was silently ignored after the first upload
              // and the plan kept selling at the old cost.
              //
              // A blank/zero cell means "not supplied", never "free": leaving
              // the column out must not wipe a price that is already set.
              if (
                costPrice > 0 &&
                Number(existingPlan.costPrice) !== costPrice
              ) {
                planPatch.costPrice = costPrice;
                // Priced with the current margin tier, exactly like a newly
                // created plan. Storing the bare cost here left a re-priced
                // plan selling at cost — no profit — until the next full sync
                // happened to recalculate it (#010).
                const retailVnd =
                  existingPlan.isLocalInventory === false
                    ? price
                    : await this.plansService.localRetailVnd(costPrice);
                planPatch.price = retailVnd;
                planPatch.vndPrice = retailVnd;
              }

              if (
                sellPrice > 0 &&
                Number(existingPlan.retailPrice) !== sellPrice
              ) {
                planPatch.retailPrice = sellPrice;
              }

              // Nhập lại bằng nút còn lại là cách sửa một gói đã bị phân loại
              // sai. Không chép cờ ở đây thì gói đó mắc kẹt ở tab sai và người
              // dùng không có đường nào tự sửa ngoài vào database.
              const wantDomestic = esimKind === 'domestic';
              // So sánh qua `=== true` để `undefined` đọc là false. Thiếu bước
              // này thì mọi lần nhập loại 'travel' đều sinh ra một patch dù
              // chẳng có gì đổi, và "nhập lại không thay đổi" hoá ra vẫn ghi.
              if ((existingPlan.isDomesticEsim === true) !== wantDomestic) {
                planPatch.isDomesticEsim = wantDomestic;
              }

              // A re-upload of the domestic template refreshes the plan's
              // perks (#066) — minutes, cycle data, renewal fee.
              if (
                domesticOffer &&
                JSON.stringify(existingPlan.domesticOffer ?? null) !==
                  JSON.stringify(domesticOffer)
              ) {
                planPatch.domesticOffer = domesticOffer;
              }
              if (ipExport && existingPlan.ipExport !== ipExport) {
                planPatch.ipExport = ipExport;
              }
              // The domestic template also defines the plan's shape: a plan
              // first imported with the old template stayed "daily / 30 days"
              // even when the file said Month or 12 cycles.
              if (domesticOffer) {
                if (existingPlan.type !== type.toLowerCase())
                  planPatch.type = type.toLowerCase();
                if (durationDays && existingPlan.durationDays !== durationDays)
                  planPatch.durationDays = durationDays;
                if (dataMb && existingPlan.dataMb !== dataMb)
                  planPatch.dataMb = dataMb;
              }

              if (Object.keys(planPatch).length > 0) {
                // Through the service, not the repository: it is what converts
                // the new đồng prices into the USD columns (#009). Straight to
                // the repository, a re-upload left `usdPrice` at its old value
                // and orders for this plan kept totalling the stale figure.
                await this.plansService.update(existingPlan.id, planPatch);
                if (planPatch.costPrice || planPatch.retailPrice) {
                  result.planUpdated++;
                  this.logger.log(
                    `Updated prices on plan "${planSlug}" (id=${existingPlan.id}): ` +
                      `cost ${existingPlan.costPrice} → ${planPatch.costPrice ?? existingPlan.costPrice}, ` +
                      `sell ${existingPlan.retailPrice} → ${planPatch.retailPrice ?? existingPlan.retailPrice}`,
                  );
                } else {
                  this.logger.log(
                    `Backfilled destinationId=${destinationId} on plan "${planSlug}" (id=${existingPlan.id})`,
                  );
                }
              }
            } else {
              const newPlan = await this.plansService.create({
                provider: rowProvider,
                providerPlanId,
                name: planName,
                slug: planSlug,
                countryCode: rowCountryCode.toUpperCase(),
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
                ipExport: ipExport ?? undefined,
                domesticOffer: domesticOffer ?? null,
                isActive: true,
                isLocalInventory: true,
                isDomesticEsim: esimKind === 'domestic',
                vndPrice: price,
              });
              planId = newPlan.id;
              planCache.set(planSlug, planId);
              result.planCreated++;
            }
          }
        }

        if (alreadyInStock) {
          result.skipped++;
          result.errors.push({
            row: rowNum,
            iccid,
            error: 'ICCID already exists',
          });
          continue;
        }

        // Extract esim fields
        const phoneNumber = this.cellStr(cellAt(row, 'phone number', 21));
        const lpa = this.cellStr(cellAt(row, 'lpa', 22));

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

        if (shouldRestore) {
          // Restore the soft-deleted record and update with new import data
          await this.esimRepository.restore(existing.id);
          await this.esimRepository.update(existing.id, {
            phoneNumber: phoneNumber ?? null,
            lpa: lpa ?? null,
            smdpAddress,
            activationCode,
            provider: rowProvider,
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
        } else {
          await this.esimRepository.create({
            iccid,
            phoneNumber: phoneNumber ?? null,
            lpa: lpa ?? null,
            smdpAddress,
            activationCode,
            provider: rowProvider,
            planId: planId ?? null,
            orderItemId: null,
            userId: null,
            matchId: null,
            qrcode: null,
            qrAccessToken: crypto.randomUUID(),
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
        }

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
    // A formula cell ("=O3+100000" in the domestic template's prices, #066)
    // arrives as { formula, result }: Number() of that object is NaN, so the
    // price read as missing.
    if (typeof value === 'object' && 'result' in value)
      return this.cellNum(value.result);
    if (typeof value === 'string' && !value.trim()) return null;
    const n = Number(value);
    return isNaN(n) ? null : n;
  }

  /** The perk columns of the domestic template (#066), as one offer. */
  private readDomesticOffer(
    row: Row,
    cellAt: (row: Row, name: string) => unknown,
  ): DomesticOffer {
    const text = (name: string) => this.cellStr(cellAt(row, name));
    const count = (name: string) => offerCount(this.cellNum(cellAt(row, name)));
    const dataPeriod = parseDataPeriod(text('data period'));
    const firstCycleDataMb = parseOfferDataMb(text('1st cycle data'));
    const recurringRaw = text('recurring data');
    return {
      firstCycleDataMb,
      // Blank means "same as the first cycle", not unlimited.
      recurringDataMb: recurringRaw
        ? parseOfferDataMb(recurringRaw)
        : firstCycleDataMb,
      dataPeriod,
      bundleType: parseBundleType(text('bundle type'), dataPeriod),
      offNetMinutes: count('off-net minutes'),
      onNetMinutes: count('on-net minutes'),
      domesticMinutes: count('domestic minutes'),
      offNetSms: count('off-net sms'),
      onNetSms: count('on-net sms'),
      zeroRatedSocial: this.parseVietnameseBoolean(
        text('zero-rated social data'),
      ),
      cycleFeeVnd: this.cellNum(cellAt(row, 'cycle fee')),
      cycleMonths: Math.max(1, count('no. of cycles')),
      supportPhone: text('support phone number'),
    };
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
    // Handle string dates
    const str = (
      typeof value === 'object' && 'text' in value ? value.text : String(value)
    ).trim();
    if (!str) return null;

    // Handle dd/mm/yyyy (or dd-mm-yyyy) — the format used in the import Excel.
    // new Date() would misread this as mm/dd/yyyy, so parse it explicitly.
    const dmy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (dmy) {
      const day = Number(dmy[1]);
      const month = Number(dmy[2]);
      const year = Number(dmy[3]);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        // Use UTC to avoid timezone shifting the date across day boundaries
        const parsed = new Date(Date.UTC(year, month - 1, day));
        return isNaN(parsed.getTime()) ? null : parsed;
      }
    }

    // Fallback: ISO-like strings such as "2026-11-06"
    const parsed = new Date(str);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  /**
   * Normalize carrier name to a slug-friendly provider string.
   * e.g. "Viettel" → "viettel", "eSIMvn" → "esimvn"
   */
  private normalizeProvider(carrier: string): string {
    return carrier
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }
}
