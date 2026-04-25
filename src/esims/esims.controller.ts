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
  Request,
  NotFoundException,
} from '@nestjs/common';
import { CreateEsimDto } from './dto/create-esim.dto';
import { UpdateEsimDto } from './dto/update-esim.dto';
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
import { QueryEsimDto } from './dto/query-esim.dto';
import { Esim } from './domain/esim';
import { EsimsService } from './esims.service';
import { RolesGuard } from '../roles/roles.guard';
import { infinityPagination } from '../utils/infinity-pagination';
import { DataUsageResult } from './esims.service';

@ApiBearerAuth()
@Roles(RoleEnum.admin)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiTags('Esims')
@Controller({ path: 'esims', version: '1' })
export class EsimsController {
  constructor(private readonly esimsService: EsimsService) {}

  @Roles(RoleEnum.user, RoleEnum.admin)
  @ApiOkResponse({ type: InfinityPaginationResponse(Esim) })
  @Get('my/list')
  @HttpCode(HttpStatus.OK)
  async findMyEsims(
    @Request() req: { user: { id: number } },
    @Query() query: QueryEsimDto,
  ): Promise<InfinityPaginationResponseDto<Esim>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) limit = 50;

    return infinityPagination(
      await this.esimsService.findManyWithPagination({
        filterOptions: { ...query?.filters, userId: req.user.id },
        sortOptions: query?.sort,
        paginationOptions: { page, limit },
      }),
      { page, limit },
    );
  }

  @Roles(RoleEnum.user, RoleEnum.admin)
  @ApiOkResponse({ type: Esim })
  @Get('my/:id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: Number, required: true })
  async findMyEsimById(
    @Request() req: { user: { id: number } },
    @Param('id') id: number,
  ): Promise<Esim> {
    const esim = await this.esimsService.findById(id);
    if (!esim || esim.userId !== req.user.id) {
      throw new NotFoundException();
    }
    return esim;
  }

  @Roles(RoleEnum.user, RoleEnum.admin)
  @ApiOkResponse()
  @Get('my/:id/data-usage')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: Number, required: true })
  async getMyEsimDataUsage(
    @Request() req: { user: { id: number } },
    @Param('id') id: number,
  ): Promise<DataUsageResult> {
    const esim = await this.esimsService.findById(id);
    if (!esim || esim.userId !== req.user.id) {
      throw new NotFoundException();
    }
    return this.esimsService.getDataUsage(esim);
  }

  @ApiCreatedResponse({ type: Esim })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createEsimDto: CreateEsimDto): Promise<Esim> {
    return this.esimsService.create(createEsimDto);
  }

  @ApiOkResponse({ type: InfinityPaginationResponse(Esim) })
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query() query: QueryEsimDto,
  ): Promise<InfinityPaginationResponseDto<Esim>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) limit = 50;

    return infinityPagination(
      await this.esimsService.findManyWithPagination({
        filterOptions: query?.filters,
        sortOptions: query?.sort,
        paginationOptions: { page, limit },
      }),
      { page, limit },
    );
  }

  @ApiOkResponse({ type: Esim })
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  findOne(@Param('id') id: Esim['id']): Promise<NullableType<Esim>> {
    return this.esimsService.findById(id);
  }

  @ApiOkResponse({ type: Esim })
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  update(
    @Param('id') id: Esim['id'],
    @Body() updateEsimDto: UpdateEsimDto,
  ): Promise<Esim | null> {
    return this.esimsService.update(id, updateEsimDto);
  }

  @Delete(':id')
  @ApiParam({ name: 'id', type: String, required: true })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: Esim['id']): Promise<void> {
    return this.esimsService.remove(id);
  }
}
