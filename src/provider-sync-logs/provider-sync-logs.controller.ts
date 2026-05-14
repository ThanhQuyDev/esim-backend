import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Query,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { CreateProviderSyncLogDto } from './dto/create-provider-sync-log.dto';
import { UpdateProviderSyncLogDto } from './dto/update-provider-sync-log.dto';
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
import { QueryProviderSyncLogDto } from './dto/query-provider-sync-log.dto';
import { ProviderSyncLog } from './domain/provider-sync-log';
import { ProviderSyncLogsService } from './provider-sync-logs.service';
import { RolesGuard } from '../roles/roles.guard';
import { infinityPagination } from '../utils/infinity-pagination';

@ApiBearerAuth()
@Roles(RoleEnum.admin)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiTags('ProviderSyncLogs')
@Controller({ path: 'provider-sync-logs', version: '1' })
export class ProviderSyncLogsController {
  constructor(
    private readonly providerSyncLogsService: ProviderSyncLogsService,
  ) {}

  @ApiCreatedResponse({ type: ProviderSyncLog })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() createDto: CreateProviderSyncLogDto,
  ): Promise<ProviderSyncLog> {
    return this.providerSyncLogsService.create(createDto);
  }

  @ApiOkResponse({ type: InfinityPaginationResponse(ProviderSyncLog) })
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query() query: QueryProviderSyncLogDto,
  ): Promise<InfinityPaginationResponseDto<ProviderSyncLog>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) limit = 50;

    const [data, count] =
      await this.providerSyncLogsService.findManyWithPagination({
        filterOptions: query?.filters,
        sortOptions: query?.sort,
        paginationOptions: { page, limit },
      });

    return infinityPagination(data, { page, limit }, count);
  }

  @ApiOkResponse({ type: ProviderSyncLog })
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  findOne(
    @Param('id') id: ProviderSyncLog['id'],
  ): Promise<NullableType<ProviderSyncLog>> {
    return this.providerSyncLogsService.findById(id);
  }

  @ApiOkResponse({ type: ProviderSyncLog })
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  update(
    @Param('id') id: ProviderSyncLog['id'],
    @Body() updateDto: UpdateProviderSyncLogDto,
  ): Promise<ProviderSyncLog | null> {
    return this.providerSyncLogsService.update(id, updateDto);
  }
}
