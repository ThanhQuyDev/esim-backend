import { PartialType } from '@nestjs/swagger';
import { CreateSupportedDeviceDto } from './create-supported-device.dto';

export class UpdateSupportedDeviceDto extends PartialType(
  CreateSupportedDeviceDto,
) {}
