import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import {
  ProviderSalesStatusDto,
  SetProviderSalesStatusDto,
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
