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
import { CreateSeoConfigDto } from './dto/create-seo-config.dto';
import { UpdateSeoConfigDto } from './dto/update-seo-config.dto';
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
import { QuerySeoConfigDto } from './dto/query-seo-config.dto';
import { SeoConfig } from './domain/seo-config';
import { SeoConfigsService } from './seo-configs.service';
import { RolesGuard } from '../roles/roles.guard';
import { infinityPagination } from '../utils/infinity-pagination';

@ApiTags('SeoConfigs')
@Controller({
  path: 'seo-configs',
  version: '1',
})
export class SeoConfigsController {
  constructor(private readonly seoConfigsService: SeoConfigsService) {}

  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiCreatedResponse({ type: SeoConfig })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createSeoConfigDto: CreateSeoConfigDto): Promise<SeoConfig> {
    return this.seoConfigsService.create(createSeoConfigDto);
  }

  @ApiOkResponse({ type: InfinityPaginationResponse(SeoConfig) })
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query() query: QuerySeoConfigDto,
  ): Promise<InfinityPaginationResponseDto<SeoConfig>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 500) limit = 500;

    const [data, count] = await this.seoConfigsService.findManyWithPagination({
      filterOptions: query?.filters,
      sortOptions: query?.sort,
      paginationOptions: { page, limit },
    });

    return infinityPagination(data, { page, limit }, count);
  }

  @ApiOkResponse({ type: SeoConfig })
  @Get('by-url')
  @HttpCode(HttpStatus.OK)
  findByUrl(@Query('url') url: string): Promise<NullableType<SeoConfig>> {
    return this.seoConfigsService.findByUrl(url);
  }

  @ApiOkResponse({ type: SeoConfig })
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  findOne(@Param('id') id: SeoConfig['id']): Promise<NullableType<SeoConfig>> {
    return this.seoConfigsService.findById(id);
  }

  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiOkResponse({ type: SeoConfig })
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  update(
    @Param('id') id: SeoConfig['id'],
    @Body() updateSeoConfigDto: UpdateSeoConfigDto,
  ): Promise<SeoConfig | null> {
    return this.seoConfigsService.update(id, updateSeoConfigDto);
  }

  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Delete(':id')
  @ApiParam({ name: 'id', type: String, required: true })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: SeoConfig['id']): Promise<void> {
    return this.seoConfigsService.remove(id);
  }
}
