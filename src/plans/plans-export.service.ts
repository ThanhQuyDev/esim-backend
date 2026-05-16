import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PlanRepository } from './infrastructure/persistence/plan.repository';
import { FilterPlanDto } from './dto/query-plan.dto';
import { Plan } from './domain/plan';
import { RegionsService } from '../regions/regions.service';

@Injectable()
export class PlansExportService {
  constructor(
    private readonly plansRepository: PlanRepository,
    private readonly regionsService: RegionsService,
  ) {}

  async exportToExcel(filterOptions?: FilterPlanDto | null): Promise<Buffer> {
    const plans = await this.plansRepository.findAllForExport(filterOptions);

    // Enrich plans with region destinations
    const regionIds = [
      ...new Set(
        plans.filter((p) => p.regionId).map((p) => p.regionId as number),
      ),
    ];
    if (regionIds.length) {
      const regionMap = new Map<number, any>();
      for (const regionId of regionIds) {
        const region = await this.regionsService.findById(regionId);
        if (region) regionMap.set(regionId, region);
      }
      for (const plan of plans) {
        if (plan.regionId && regionMap.has(plan.regionId)) {
          plan.region = regionMap.get(plan.regionId);
        }
      }
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'eSIM Management System';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Plans');

    worksheet.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Tên gói', key: 'name', width: 30 },
      { header: 'Slug', key: 'slug', width: 30 },
      { header: 'Provider', key: 'provider', width: 15 },
      { header: 'Provider Plan ID', key: 'providerPlanId', width: 18 },
      { header: 'Quốc gia', key: 'destination', width: 20 },
      { header: 'Mã quốc gia', key: 'countryCode', width: 12 },
      { header: 'Khu vực', key: 'region', width: 20 },
      {
        header: 'Quốc gia trong khu vực',
        key: 'regionDestinations',
        width: 40,
      },
      { header: 'Loại', key: 'type', width: 15 },
      { header: 'Dung lượng (MB)', key: 'dataMb', width: 16 },
      { header: 'Thời hạn (ngày)', key: 'durationDays', width: 16 },
      { header: 'Giá gốc (USD)', key: 'costPrice', width: 14 },
      { header: 'Giá bán (USD)', key: 'price', width: 14 },
      { header: 'Giá lẻ (USD)', key: 'retailPrice', width: 14 },
      { header: 'Giá VND', key: 'vndPrice', width: 14 },
      { header: 'Giảm giá (%)', key: 'discount', width: 12 },
      { header: 'Tốc độ', key: 'speed', width: 12 },
      { header: 'Nhà mạng', key: 'operatorName', width: 20 },
      { header: 'FUP Speed', key: 'fupSpeed', width: 12 },
      { header: 'SMS', key: 'sms', width: 8 },
      { header: 'Call', key: 'call', width: 8 },
      { header: 'Top Up', key: 'topUp', width: 10 },
      { header: 'KYC', key: 'isKyc', width: 8 },
      { header: 'Local Inventory', key: 'isLocalInventory', width: 15 },
      { header: 'Multi-date', key: 'isAbleMultidate', width: 12 },
      { header: 'Rẻ nhất', key: 'isCheapest', width: 10 },
      { header: 'Active', key: 'isActive', width: 10 },
      { header: 'APN', key: 'apn', width: 12 },
      { header: 'Ngày tạo', key: 'createdAt', width: 20 },
    ];

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // Add data rows
    plans.forEach((plan: Plan) => {
      worksheet.addRow({
        id: plan.id,
        name: plan.name,
        slug: plan.slug,
        provider: plan.provider,
        providerPlanId: plan.providerPlanId,
        destination: plan.destination?.name ?? '',
        countryCode: plan.countryCode ?? '',
        region: plan.region?.name ?? '',
        regionDestinations: plan.region?.destinations
          ? plan.region.destinations.map((d) => d.name).join(', ')
          : '',
        type: plan.type,
        dataMb: plan.dataMb,
        durationDays: plan.durationDays,
        costPrice: Number(plan.costPrice),
        price: Number(plan.price),
        retailPrice: Number(plan.retailPrice),
        vndPrice: Number(plan.vndPrice),
        discount: Number(plan.discount),
        speed: plan.speed ?? '',
        operatorName: plan.operatorName ?? '',
        fupSpeed: plan.fupSpeed ?? '',
        sms: plan.sms ?? '',
        call: plan.call ?? '',
        topUp: plan.topUp ? 'Có' : 'Không',
        isKyc: plan.isKyc ? 'Có' : 'Không',
        isLocalInventory: plan.isLocalInventory ? 'Có' : 'Không',
        isAbleMultidate: plan.isAbleMultidate ? 'Có' : 'Không',
        isCheapest: plan.isCheapest ? 'Có' : 'Không',
        isActive: plan.isActive ? 'Có' : 'Không',
        apn: plan.apn ?? '',
        createdAt: this.formatDate(plan.createdAt),
      });
    });

    // Auto-filter
    worksheet.autoFilter = {
      from: 'A1',
      to: `AD${plans.length + 1}`,
    };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private formatDate(date: Date): string {
    return new Date(date).toISOString().replace('T', ' ').substring(0, 19);
  }
}
