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

  create(createDto: CreateSupportedDeviceDto) {
    return this.supportedDeviceRepository.create({
      device: createDto.device,
      manufacturer: createDto.manufacturer,
      type: createDto.type,
    });
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

  async findGrouped() {
    const devices = await this.supportedDeviceRepository.findGrouped();

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

  update(id: SupportedDevice['id'], updateDto: UpdateSupportedDeviceDto) {
    return this.supportedDeviceRepository.update(id, {
      device: updateDto.device,
      manufacturer: updateDto.manufacturer,
      type: updateDto.type,
    });
  }

  remove(id: SupportedDevice['id']) {
    return this.supportedDeviceRepository.remove(id);
  }
}
