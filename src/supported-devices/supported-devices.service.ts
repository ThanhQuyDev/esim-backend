import { Injectable } from '@nestjs/common';
import { CreateSupportedDeviceDto } from './dto/create-supported-device.dto';
import { UpdateSupportedDeviceDto } from './dto/update-supported-device.dto';
import { SaveSupportedDeviceOrderingDto } from './dto/save-supported-device-ordering.dto';
import { SupportedDeviceRepository } from './infrastructure/persistence/supported-device.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { SupportedDevice, DeviceType } from './domain/supported-device';
import {
  DEVICE_TYPE_ORDER,
  compareBrands,
  compareModels,
  typeIndex,
} from './supported-device-order';

/** One brand on the CMS ordering screen, with its models (#047). */
export interface SupportedDeviceBrandOrdering {
  manufacturer: string;
  manufacturerOrder: number;
  devices: {
    id: string;
    device: string;
    type: DeviceType;
    sortOrder: number;
  }[];
}

@Injectable()
export class SupportedDevicesService {
  constructor(
    private readonly supportedDeviceRepository: SupportedDeviceRepository,
  ) {}

  async create(createDto: CreateSupportedDeviceDto) {
    // A new model of a brand that is already positioned takes the brand's
    // position (#047). Before, the CMS always sent 0, and the sync below then
    // reset the whole brand — adding one Samsung undid Samsung's place.
    const inheritedBrandOrder =
      createDto.manufacturerOrder === undefined
        ? await this.supportedDeviceRepository.findManufacturerOrder(
            createDto.manufacturer,
          )
        : undefined;

    const created = await this.supportedDeviceRepository.create({
      device: createDto.device,
      manufacturer: createDto.manufacturer,
      type: createDto.type,
      manufacturerOrder:
        createDto.manufacturerOrder ?? inheritedBrandOrder ?? 0,
      sortOrder: createDto.sortOrder ?? 0,
    });

    await this.syncManufacturerOrder(
      createDto.manufacturer,
      createDto.manufacturerOrder,
    );

    return created;
  }

  /**
   * A brand's position is stored on every one of its devices (#090).
   *
   * An admin sets it on whichever row they happen to be editing, so the
   * value is pushed to the brand's other rows — otherwise one Apple device
   * would sit at position 1 and the rest of Apple stay wherever they were,
   * splitting the brand across the page.
   */
  private async syncManufacturerOrder(
    manufacturer: string | undefined,
    manufacturerOrder: number | undefined,
  ): Promise<void> {
    if (!manufacturer || manufacturerOrder === undefined) return;
    await this.supportedDeviceRepository.setManufacturerOrder(
      manufacturer,
      manufacturerOrder,
    );
  }

  findAllWithPagination({
    paginationOptions,
    type,
    search,
  }: {
    paginationOptions: IPaginationOptions;
    type?: DeviceType;
    search?: string;
  }) {
    return this.supportedDeviceRepository.findAllWithPagination({
      paginationOptions,
      type,
      search,
    });
  }

  async findGrouped(search?: string) {
    // Already in display order, so first-seen order of each Map is that order.
    const devices = await this.supportedDeviceRepository.findGrouped(search);

    const groupMap = new Map<
      string,
      Map<string, { id: string; device: string }[]>
    >();

    for (const d of devices) {
      if (!groupMap.has(d.type)) {
        groupMap.set(d.type, new Map());
      }
      const mfMap = groupMap.get(d.type)!;
      if (!mfMap.has(d.manufacturer)) {
        mfMap.set(d.manufacturer, []);
      }
      mfMap.get(d.manufacturer)!.push({ id: d.id, device: d.device });
    }

    return DEVICE_TYPE_ORDER.filter((t) => groupMap.has(t)).map((t) => ({
      type: t,
      manufacturers: Array.from(groupMap.get(t)!.entries()).map(
        ([manufacturer, devs]) => ({
          manufacturer,
          devices: devs,
        }),
      ),
    }));
  }

  /**
   * Brands in display order, each with its models (#047).
   *
   * 340 devices in one flat list were too hard to order by hand. The CMS now
   * sets a brand's position once, and a model's position inside its brand.
   */
  async findOrdering(): Promise<SupportedDeviceBrandOrdering[]> {
    const devices = await this.supportedDeviceRepository.findGrouped();
    const brands = new Map<string, SupportedDeviceBrandOrdering>();

    for (const d of devices) {
      let brand = brands.get(d.manufacturer);
      if (!brand) {
        brand = {
          manufacturer: d.manufacturer,
          manufacturerOrder: d.manufacturerOrder ?? 0,
          devices: [],
        };
        brands.set(d.manufacturer, brand);
      }
      // Rows of one brand should agree; if not, the numbered one wins.
      if (!brand.manufacturerOrder && d.manufacturerOrder) {
        brand.manufacturerOrder = d.manufacturerOrder;
      }
      brand.devices.push({
        id: d.id,
        device: d.device,
        type: d.type,
        sortOrder: d.sortOrder ?? 0,
      });
    }

    return Array.from(brands.values())
      .sort(compareBrands)
      .map((brand) => ({
        ...brand,
        devices: [...brand.devices].sort(
          (a, b) =>
            typeIndex(a.type) - typeIndex(b.type) || compareModels(a, b),
        ),
      }));
  }

  /** Save the positions changed on the CMS ordering screen (#047). */
  async saveOrdering(
    dto: SaveSupportedDeviceOrderingDto,
  ): Promise<SupportedDeviceBrandOrdering[]> {
    for (const item of dto.manufacturers ?? []) {
      await this.supportedDeviceRepository.setManufacturerOrder(
        item.manufacturer,
        item.manufacturerOrder,
      );
    }
    if (dto.devices?.length) {
      await this.supportedDeviceRepository.setSortOrders(dto.devices);
    }
    return this.findOrdering();
  }

  findById(id: SupportedDevice['id']) {
    return this.supportedDeviceRepository.findById(id);
  }

  async update(id: SupportedDevice['id'], updateDto: UpdateSupportedDeviceDto) {
    const updated = await this.supportedDeviceRepository.update(id, {
      device: updateDto.device,
      manufacturer: updateDto.manufacturer,
      type: updateDto.type,
      manufacturerOrder: updateDto.manufacturerOrder,
      sortOrder: updateDto.sortOrder,
    });

    await this.syncManufacturerOrder(
      updateDto.manufacturer ?? updated?.manufacturer,
      updateDto.manufacturerOrder,
    );

    return updated;
  }

  remove(id: SupportedDevice['id']) {
    return this.supportedDeviceRepository.remove(id);
  }
}
