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
  ProviderSurchargeDto,
  UpsertProviderSurchargeDto,
} from './dto/provider-surcharge.dto';
import { ProviderSurchargesService } from './provider-surcharges.service';

@ApiTags('ProviderSurcharges')
@ApiBearerAuth()
@Roles(RoleEnum.admin)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'provider-surcharges', version: '1' })
export class ProviderSurchargesController {
  constructor(private readonly service: ProviderSurchargesService) {}

  /** Every supplier with the tax / fee used when comparing prices (#049). */
  @ApiOkResponse({ type: [ProviderSurchargeDto] })
  @Get()
  @HttpCode(HttpStatus.OK)
  async list(): Promise<{ data: ProviderSurchargeDto[] }> {
    return { data: await this.service.list() };
  }

  /** Set one supplier's surcharge, then re-pick the cheapest plans. */
  @ApiOkResponse({ type: ProviderSurchargeDto })
  @Put(':provider')
  @HttpCode(HttpStatus.OK)
  async upsert(
    @Param('provider') provider: string,
    @Body() dto: UpsertProviderSurchargeDto,
  ): Promise<{ data: ProviderSurchargeDto }> {
    return { data: await this.service.upsert(provider, dto) };
  }
}
