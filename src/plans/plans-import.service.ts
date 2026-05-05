import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { Workbook, Worksheet, CellValue } from 'exceljs';
import { PlanColumnMapping } from './dto/import-plans-excel.dto';
import { PlansService } from './plans.service';

export interface ImportResult {
  total: number;
  created: number;
  skipped: number;
  errors: Array<{ row: number; error: string }>;
}

@Injectable()
export class PlansImportService {
  private readonly logger = new Logger(PlansImportService.name);

  constructor(private readonly plansService: PlansService) {}

  async importFromExcel(
    fileBuffer: Buffer,
    provider: string,
    columnMapping: PlanColumnMapping,
    sheetIdentifier?: string,
  ): Promise<ImportResult> {
    const workbook = new Workbook();
    await workbook.xlsx.load(fileBuffer as any);

    const worksheet = this.getWorksheet(workbook, sheetIdentifier);
    if (!worksheet) {
      throw new BadRequestException('Worksheet not found');
    }

    const headerRow = worksheet.getRow(1);
    const headerMap = this.buildHeaderMap(headerRow);

    // Validate that all mapped columns exist in the Excel
    this.validateColumnMapping(columnMapping, headerMap);

    const result: ImportResult = {
      total: 0,
      created: 0,
      skipped: 0,
      errors: [],
    };

    // Iterate rows starting from row 2 (skip header)
    for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum++) {
      const row = worksheet.getRow(rowNum);

      // Skip empty rows
      if (this.isEmptyRow(row)) continue;

      result.total++;

      try {
        const planData = this.mapRowToPlan(
          row,
          provider,
          columnMapping,
          headerMap,
        );
        await this.plansService.create(planData);
        result.created++;
      } catch (error: any) {
        result.skipped++;
        result.errors.push({
          row: rowNum,
          error: error?.message || 'Unknown error',
        });
        this.logger.warn(`Row ${rowNum} import failed: ${error?.message}`);
      }
    }

    // Refresh providers on destinations and regions after import
    try {
      await this.plansService.refreshProviders();
    } catch (error: any) {
      this.logger.error(`Failed to refresh providers: ${error.message}`);
    }

    return result;
  }

  private getWorksheet(
    workbook: Workbook,
    sheetIdentifier?: string,
  ): Worksheet | undefined {
    if (!sheetIdentifier) {
      return workbook.worksheets[0];
    }

    const sheetIndex = Number(sheetIdentifier);
    if (!isNaN(sheetIndex)) {
      return workbook.worksheets[sheetIndex];
    }

    return workbook.getWorksheet(sheetIdentifier);
  }

  private buildHeaderMap(headerRow: any): Map<string, number> {
    const map = new Map<string, number>();
    headerRow.eachCell(
      { includeEmpty: false },
      (cell: any, colNumber: number) => {
        const value = this.getCellString(cell.value);
        if (value) {
          map.set(value.trim().toLowerCase(), colNumber);
        }
      },
    );
    return map;
  }

  private validateColumnMapping(
    mapping: PlanColumnMapping,
    headerMap: Map<string, number>,
  ): void {
    const missingColumns: string[] = [];
    for (const [field, excelColumn] of Object.entries(mapping)) {
      if (excelColumn && !headerMap.has(excelColumn.trim().toLowerCase())) {
        missingColumns.push(`${field} -> "${excelColumn}"`);
      }
    }
    if (missingColumns.length > 0) {
      throw new BadRequestException(
        `Excel columns not found: ${missingColumns.join(', ')}`,
      );
    }
  }

  private isEmptyRow(row: any): boolean {
    let empty = true;
    row.eachCell({ includeEmpty: false }, () => {
      empty = false;
    });
    return empty;
  }

  private mapRowToPlan(
    row: any,
    provider: string,
    mapping: PlanColumnMapping,
    headerMap: Map<string, number>,
  ): any {
    const getValue = (
      field: keyof PlanColumnMapping,
    ): CellValue | undefined => {
      const colName = mapping[field];
      if (!colName) return undefined;
      const colNum = headerMap.get(colName.trim().toLowerCase());
      if (!colNum) return undefined;
      return row.getCell(colNum).value;
    };

    const providerPlanId = this.getCellString(getValue('providerPlanId')) || '';
    const name = this.getCellString(getValue('name')) || '';
    const slug =
      this.getCellString(getValue('slug')) ||
      `${provider}-${providerPlanId}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    const durationDays = this.getCellNumber(getValue('durationDays')) ?? 0;
    const dataMb = this.getCellNumber(getValue('dataMb')) ?? 0;
    const costPrice = this.getCellNumber(getValue('costPrice')) ?? 0;
    const price = this.getCellNumber(getValue('price')) ?? 0;
    const retailPrice = this.getCellNumber(getValue('retailPrice')) ?? 0;
    const currency = this.getCellString(getValue('currency')) || 'USD';

    return {
      provider,
      providerPlanId,
      name,
      slug,
      countryCode: this.getCellString(getValue('countryCode')) || null,
      destinationId: this.getCellNumber(getValue('destinationId')) || null,
      regionId: this.getCellNumber(getValue('regionId')) || null,
      durationDays,
      dataMb,
      costPrice,
      price,
      retailPrice,
      currency,
      sms: this.getCellNumber(getValue('sms')) ?? null,
      call: this.getCellNumber(getValue('call')) ?? null,
      type: this.getCellString(getValue('type')) || 'data-in-total',
      topUp: this.getCellBoolean(getValue('topUp')) ?? false,
      isActive: this.getCellBoolean(getValue('isActive')) ?? true,
      speed: this.getCellString(getValue('speed')) || null,
      operatorName: this.getCellString(getValue('operatorName')) || null,
      fupSpeed: this.getCellString(getValue('fupSpeed')) || null,
    };
  }

  private getCellString(value: CellValue | undefined): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'object' && 'text' in value) return value.text;
    if (typeof value === 'object' && 'result' in value)
      return String(value.result);
    return String(value);
  }

  private getCellNumber(value: CellValue | undefined): number | null {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    return isNaN(num) ? null : num;
  }

  private getCellBoolean(value: CellValue | undefined): boolean | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'boolean') return value;
    const str = String(value).toLowerCase().trim();
    if (['true', '1', 'yes'].includes(str)) return true;
    if (['false', '0', 'no'].includes(str)) return false;
    return null;
  }
}
