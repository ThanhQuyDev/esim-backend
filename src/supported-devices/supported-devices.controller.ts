import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { SupportedDevicesService } from './supported-devices.service';
import { CreateSupportedDeviceDto } from './dto/create-supported-device.dto';
import { UpdateSupportedDeviceDto } from './dto/update-supported-device.dto';
import { FindAllSupportedDevicesDto } from './dto/find-all-supported-devices.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { SupportedDevice } from './domain/supported-device';
import { AuthGuard } from '@nestjs/passport';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { infinityPagination } from '../utils/infinity-pagination';

@ApiTags('SupportedDevices')
@Controller({
  path: 'supported-devices',
  version: '1',
})
export class SupportedDevicesController {
  constructor(
    private readonly supportedDevicesService: SupportedDevicesService,
  ) {}

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post()
  @ApiCreatedResponse({ type: SupportedDevice })
  create(@Body() createDto: CreateSupportedDeviceDto) {
    return this.supportedDevicesService.create(createDto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get()
  @ApiOkResponse({ type: InfinityPaginationResponse(SupportedDevice) })
  async findAll(@Query() query: FindAllSupportedDevicesDto): Promise<
    InfinityPaginationResponseDto<SupportedDevice> & {
      page: number;
      limit: number;
      totalPages: number;
    }
  > {
    // Bug 1.1 fix — make pagination fully dynamic from request, never hardcoded.
    // page defaults to 1, limit defaults to 10 and is capped at 100 to keep the
    // admin grid responsive while still allowing realistic page sizes (25/50/100).
    const page = Number(query?.page) > 0 ? Number(query.page) : 1;
    let limit = Number(query?.limit) > 0 ? Number(query.limit) : 10;
    if (limit > 100) limit = 100;

    const [data, count] =
      await this.supportedDevicesService.findAllWithPagination({
        paginationOptions: { page, limit },
        type: query.type,
        search: query.search,
      });

    const base = infinityPagination(data, { page, limit }, count);
    return {
      ...base,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(count / limit)),
    };
  }

  @Get('grouped')
  @ApiOkResponse()
  async findGrouped(@Query('search') search?: string) {
    return { data: await this.supportedDevicesService.findGrouped(search) };
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get(':id')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: SupportedDevice })
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.supportedDevicesService.findById(id);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Patch(':id')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: SupportedDevice })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateSupportedDeviceDto,
  ) {
    return this.supportedDevicesService.update(id, updateDto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  @ApiParam({ name: 'id', type: String, required: true })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.supportedDevicesService.remove(id);
  }
}
