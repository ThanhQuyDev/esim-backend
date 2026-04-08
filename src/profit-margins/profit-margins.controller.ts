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
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { CreateProfitMarginDto } from './dto/create-profit-margin.dto';
import { UpdateProfitMarginDto } from './dto/update-profit-margin.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { AuthGuard } from '@nestjs/passport';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { NullableType } from '../utils/types/nullable.type';
import { QueryProfitMarginDto } from './dto/query-profit-margin.dto';
import { ProfitMargin } from './domain/profit-margin';
import { ProfitMarginsService } from './profit-margins.service';
import { RolesGuard } from '../roles/roles.guard';
import { infinityPagination } from '../utils/infinity-pagination';

@ApiTags('ProfitMargins')
@ApiBearerAuth()
@Roles(RoleEnum.admin)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'profit-margins', version: '1' })
export class ProfitMarginsController {
  constructor(private readonly profitMarginsService: ProfitMarginsService) {}

  @ApiCreatedResponse({ type: ProfitMargin })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createDto: CreateProfitMarginDto): Promise<ProfitMargin> {
    return this.profitMarginsService.create(createDto);
  }

  @ApiOkResponse({ type: InfinityPaginationResponse(ProfitMargin) })
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query() query: QueryProfitMarginDto,
  ): Promise<InfinityPaginationResponseDto<ProfitMargin>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) limit = 50;

    return infinityPagination(
      await this.profitMarginsService.findManyWithPagination({
        filterOptions: query?.filters,
        sortOptions: query?.sort,
        paginationOptions: { page, limit },
      }),
      { page, limit },
    );
  }

  @ApiOkResponse({ type: ProfitMargin })
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  findOne(@Param('id') id: ProfitMargin['id']): Promise<NullableType<ProfitMargin>> {
    return this.profitMarginsService.findById(id);
  }

  @ApiOkResponse({ type: ProfitMargin })
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  update(
    @Param('id') id: ProfitMargin['id'],
    @Body() updateDto: UpdateProfitMarginDto,
  ): Promise<ProfitMargin | null> {
    return this.profitMarginsService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiParam({ name: 'id', type: String, required: true })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: ProfitMargin['id']): Promise<void> {
    return this.profitMarginsService.remove(id);
  }
}
