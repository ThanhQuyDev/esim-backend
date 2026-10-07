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
  Headers,
} from '@nestjs/common';
import { SupportedDevicesService } from './supported-devices.service';
import { CreateSupportedDeviceDto } from './dto/create-supported-device.dto';
import { UpdateSupportedDeviceDto } from './dto/update-supported-device.dto';
import { FindAllSupportedDevicesDto } from './dto/find-all-supported-devices.dto';
import { SaveSupportedDeviceOrderingDto } from './dto/save-supported-device-ordering.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
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

import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
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
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post()
  @ApiCreatedResponse({ type: SupportedDevice })
  create(@Body() createDto: CreateSupportedDeviceDto) {
    return this.supportedDevicesService.create(createDto);
  }

  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Get()
  @ApiOkResponse({ type: InfinityPaginationResponse(SupportedDevice) })
  async findAll(@Query() query: FindAllSupportedDevicesDto): Promise<
    InfinityPaginationResponseDto<SupportedDevice> & {
      page: number;
      limit: number;
      totalPages: number;
    }
  > {
    // The DTO @Transform already converts page/limit to positive integers
    // with sensible defaults (page=1, limit=10). We just cap limit at 100.
    const page = query.page ?? 1;
    let limit = query.limit ?? 10;
    if (limit > 200) limit = 200;

    const [data, count] =
      await this.supportedDevicesService.findAllWithPagination({
        paginationOptions: { page, limit },
        type: query.type,
        manufacturer: query.manufacturer,
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
  @ApiHeader({
    name: 'x-custom-lang',
    required: false,
    description: "Language of each brand's extra note: vi or en (#079).",
  })
  @ApiOkResponse()
  async findGrouped(
    @Query('search') search?: string,
    @Headers('x-custom-lang') lang?: string,
  ) {
    return {
      data: await this.supportedDevicesService.findGrouped(search, lang),
    };
  }

  /**
   * Manufacturer names for the CMS filter's select box (#052). Declared before
   * `:id`, which would otherwise capture "manufacturers".
   */
  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Get('manufacturers')
  @ApiOkResponse({
    description: 'Distinct manufacturer names, in display order',
  })
  async findManufacturers() {
    return { data: await this.supportedDevicesService.findManufacturers() };
  }

  /** Brands with their models, for the CMS ordering screen (#047). */
  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Get('ordering')
  @ApiOkResponse()
  async findOrdering() {
    return { data: await this.supportedDevicesService.findOrdering() };
  }

  /** Save brand and model positions in bulk (#047). Declared before `:id`. */
  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Patch('ordering')
  @ApiOkResponse()
  async saveOrdering(@Body() dto: SaveSupportedDeviceOrderingDto) {
    return { data: await this.supportedDevicesService.saveOrdering(dto) };
  }

  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Get(':id')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: SupportedDevice })
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.supportedDevicesService.findById(id);
  }

  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
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
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Delete(':id')
  @ApiParam({ name: 'id', type: String, required: true })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.supportedDevicesService.remove(id);
  }
}
