import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { CreateProfitMarginTierDto } from './dto/create-profit-margin-tier.dto';
import { UpdateProfitMarginTierDto } from './dto/update-profit-margin-tier.dto';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { AuthGuard } from '@nestjs/passport';
import { NullableType } from '../utils/types/nullable.type';
import { ProfitMarginTier } from './domain/profit-margin-tier';
import { ProfitMarginsService } from './profit-margins.service';
import { RolesGuard } from '../roles/roles.guard';
import { QueryProfitMarginTierDto } from './dto/query-profit-margin-tier.dto';

@ApiTags('ProfitMargins')
@ApiBearerAuth()
@Roles(RoleEnum.admin)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'profit-margins', version: '1' })
export class ProfitMarginsController {
  constructor(private readonly profitMarginsService: ProfitMarginsService) {}

  // ── Tier CRUD ──────────────────────────────────────────────

  @ApiOkResponse({ type: ProfitMarginTier })
  @Post('tiers')
  @HttpCode(HttpStatus.CREATED)
  createTier(
    @Body() dto: CreateProfitMarginTierDto,
  ): Promise<ProfitMarginTier> {
    return this.profitMarginsService.createTier(dto);
  }

  @ApiOkResponse({ type: [ProfitMarginTier] })
  @Get('tiers')
  @HttpCode(HttpStatus.OK)
  async findManyTiers(@Query() query: QueryProfitMarginTierDto) {
    const [data, count] = await this.profitMarginsService.findManyTiers({
      filterOptions: query.filters,
      sortOptions: query.sort,
      paginationOptions: {
        page: query.page ?? 1,
        limit: query.limit ?? 100,
      },
    });

    return { data, totalCount: count };
  }

  @ApiOkResponse({ type: ProfitMarginTier })
  @Get('tiers/:id')
  @HttpCode(HttpStatus.OK)
  findTierById(
    @Param('id') id: number,
  ): Promise<NullableType<ProfitMarginTier>> {
    return this.profitMarginsService.findTierById(id);
  }

  @ApiOkResponse({ type: ProfitMarginTier })
  @Put('tiers/:id')
  @HttpCode(HttpStatus.OK)
  updateTier(
    @Param('id') id: number,
    @Body() dto: UpdateProfitMarginTierDto,
  ): Promise<ProfitMarginTier> {
    return this.profitMarginsService.updateTier(id, dto);
  }

  @Delete('tiers/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeTier(@Param('id') id: number): Promise<void> {
    await this.profitMarginsService.removeTier(id);
  }
}
