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
  Headers,
  NotFoundException,
  Request,
} from '@nestjs/common';
import { HelpCenterService } from './help-center.service';
import { CreateHelpCenterDto } from './dto/create-help-center.dto';
import { UpdateHelpCenterDto } from './dto/update-help-center.dto';
import { QueryHelpCenterDto } from './dto/find-all-help-center.dto';
import { SearchHelpCenterDto } from './dto/search-help-center.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { HelpCenter } from './domain/help-center';
import { AuthGuard } from '@nestjs/passport';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { RoleEnum } from '../roles/roles.enum';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { infinityPagination } from '../utils/infinity-pagination';

@ApiTags('HelpCenter')
@Controller({
  path: 'help-center',
  version: '1',
})
export class HelpCenterController {
  constructor(private readonly helpCenterService: HelpCenterService) {}

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post()
  @ApiCreatedResponse({ type: HelpCenter })
  create(@Body() createDto: CreateHelpCenterDto) {
    return this.helpCenterService.create(createDto);
  }

  @ApiBearerAuth()
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  @ApiOkResponse({ type: InfinityPaginationResponse(HelpCenter) })
  async findAll(
    @Request() request: { user?: { role?: { id?: number | string } } },
    @Query() query: QueryHelpCenterDto,
    @Headers('x-custom-lang') lang?: string,
  ): Promise<InfinityPaginationResponseDto<HelpCenter>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) limit = 50;

    const explicitIsPublished =
      query?.isPublished !== undefined
        ? query.isPublished
        : query?.filters?.isPublished;

    // Admins see everything (drafts + published) by default. Public clients
    // only see published items unless they explicitly pass `isPublished`.
    const isAdmin = String(request?.user?.role?.id) === String(RoleEnum.admin);
    const isPublishedFilter =
      explicitIsPublished !== undefined
        ? explicitIsPublished
        : isAdmin
          ? undefined
          : true;

    const filterOptions = {
      ...query?.filters,
      search: query?.search || query?.filters?.search,
      category: query?.category || query?.filters?.category,
      parent: query?.parent || query?.filters?.parent,
      language: lang || query?.language || query?.filters?.language,
      isPopular:
        query?.isPopular !== undefined
          ? query.isPopular
          : query?.filters?.isPopular,
      isPublished: isPublishedFilter,
    };

    const [data, count] = await this.helpCenterService.findAllWithPagination({
      filterOptions,
      sortOptions: query?.sort,
      paginationOptions: { page, limit },
    });

    return infinityPagination(data, { page, limit }, count);
  }

  @Get('search')
  @ApiOkResponse({ type: InfinityPaginationResponse(HelpCenter) })
  async search(
    @Query() query: SearchHelpCenterDto,
    @Headers('x-custom-lang') lang?: string,
  ): Promise<InfinityPaginationResponseDto<HelpCenter>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) limit = 50;

    const [data, count] = await this.helpCenterService.searchForUser({
      keyword: query.q,
      language: lang || query.language,
      paginationOptions: { page, limit },
    });

    return infinityPagination(data, { page, limit }, count);
  }

  @Get('by-slug/:slug')
  @ApiParam({ name: 'slug', type: String, required: true })
  @ApiOkResponse({ type: HelpCenter })
  async findBySlug(@Param('slug') slug: string) {
    const item = await this.helpCenterService.findBySlug(slug);
    if (!item) throw new NotFoundException();
    return item;
  }

  @Get(':id')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: HelpCenter })
  findById(@Param('id') id: string) {
    return this.helpCenterService.findById(id);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Patch(':id')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: HelpCenter })
  update(@Param('id') id: string, @Body() updateDto: UpdateHelpCenterDto) {
    return this.helpCenterService.update(id, updateDto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  @ApiParam({ name: 'id', type: String, required: true })
  remove(@Param('id') id: string) {
    return this.helpCenterService.remove(id);
  }
}
