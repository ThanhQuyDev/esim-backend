import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import {
  CreateProviderDto,
  ProviderSalesStatusDto,
  SetProviderSalesStatusDto,
  UpdateProviderDto,
} from './dto/provider-sales-status.dto';
import { ProvidersService } from './providers.service';

@ApiTags('Providers')
@ApiBearerAuth()
@Roles(RoleEnum.admin)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'providers', version: '1' })
export class ProvidersController {
  constructor(private readonly service: ProvidersService) {}

  /** Every supplier with whether it is currently on sale (#005). */
  @ApiOkResponse({ type: [ProviderSalesStatusDto] })
  @Get()
  @HttpCode(HttpStatus.OK)
  async list(): Promise<{ data: ProviderSalesStatusDto[] }> {
    return { data: await this.service.list() };
  }

  /**
   * "+ Thêm nhà cung cấp" (vande-1411 #024): a domestic supplier imported by
   * file, without an API.
   */
  @ApiOkResponse({ type: ProviderSalesStatusDto })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateProviderDto,
  ): Promise<{ data: ProviderSalesStatusDto }> {
    return { data: await this.service.create(dto) };
  }

  /** "Cập nhật": its name and overview code. */
  @ApiOkResponse({ type: ProviderSalesStatusDto })
  @Patch(':provider')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('provider') provider: string,
    @Body() dto: UpdateProviderDto,
  ): Promise<{ data: ProviderSalesStatusDto }> {
    return { data: await this.service.update(provider, dto) };
  }

  /** "Xoá": only one added by hand that nothing hangs off. */
  @Delete(':provider')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('provider') provider: string): Promise<void> {
    await this.service.remove(provider);
  }

  /**
   * Switch one supplier on or off. Off takes every plan it supplies out of the
   * storefront; on puts back exactly the plans that switch took down.
   */
  @ApiOkResponse({ type: ProviderSalesStatusDto })
  @Put(':provider/sales-status')
  @HttpCode(HttpStatus.OK)
  async setSalesStatus(
    @Param('provider') provider: string,
    @Body() dto: SetProviderSalesStatusDto,
  ): Promise<{ data: ProviderSalesStatusDto }> {
    return { data: await this.service.setSalesStatus(provider, dto) };
  }
}
