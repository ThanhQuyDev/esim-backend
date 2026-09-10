import { Injectable } from '@nestjs/common';
import { CreateSupportedDeviceDto } from './dto/create-supported-device.dto';
import { UpdateSupportedDeviceDto } from './dto/update-supported-device.dto';
import { SupportedDeviceRepository } from './infrastructure/persistence/supported-device.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { SupportedDevice, DeviceType } from './domain/supported-device';

@Injectable()
export class SupportedDevicesService {
  constructor(
    private readonly supportedDeviceRepository: SupportedDeviceRepository,
  ) {}

  async create(createDto: CreateSupportedDeviceDto) {
    const created = await this.supportedDeviceRepository.create({
      device: createDto.device,
      manufacturer: createDto.manufacturer,
      type: createDto.type,
      manufacturerOrder: createDto.manufacturerOrder ?? 0,
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
    const devices = await this.supportedDeviceRepository.findGrouped(search);

    const typeOrder = [
      DeviceType.SMART_PHONES,
      DeviceType.SMART_WATCHES,
      DeviceType.TABLETS,
      DeviceType.LAPTOPS,
    ];

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

    return typeOrder
      .filter((t) => groupMap.has(t))
      .map((t) => ({
        type: t,
        manufacturers: Array.from(groupMap.get(t)!.entries()).map(
          ([manufacturer, devs]) => ({
            manufacturer,
            devices: devs,
          }),
        ),
      }));
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
