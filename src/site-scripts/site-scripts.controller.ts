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
  NotFoundException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { SiteScriptsService } from './site-scripts.service';
import { CreateSiteScriptDto } from './dto/create-site-script.dto';
import { UpdateSiteScriptDto } from './dto/update-site-script.dto';
import { FindAllSiteScriptsDto } from './dto/find-all-site-scripts.dto';
import { SiteScript } from './domain/site-script';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { infinityPagination } from '../utils/infinity-pagination';

import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
@ApiTags('SiteScripts')
@Controller({
  path: 'site-scripts',
  version: '1',
})
export class SiteScriptsController {
  constructor(private readonly siteScriptsService: SiteScriptsService) {}

  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post()
  @ApiCreatedResponse({ type: SiteScript })
  create(@Body() createSiteScriptDto: CreateSiteScriptDto) {
    return this.siteScriptsService.create(createSiteScriptDto);
  }

  @Get()
  @ApiOkResponse({ type: InfinityPaginationResponse(SiteScript) })
  async findAll(
    @Query() query: FindAllSiteScriptsDto,
  ): Promise<InfinityPaginationResponseDto<SiteScript>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    const [data, count] = await this.siteScriptsService.findAllWithPagination({
      paginationOptions: { page, limit },
    });

    return infinityPagination(data, { page, limit }, count);
  }

  /**
   * The active snippets, grouped by placement — read by every storefront page.
   *
   * Declared before `:id` so "active" is not taken for a script id.
   */
  @Get('active')
  findActive() {
    return this.siteScriptsService.findActiveByPlacement();
  }

  @Get(':id')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: SiteScript })
  async findById(@Param('id') id: string) {
    const script = await this.siteScriptsService.findById(id);
    if (!script) {
      throw new NotFoundException('Site script not found');
    }
    return script;
  }

  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Patch(':id')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: SiteScript })
  update(
    @Param('id') id: string,
    @Body() updateSiteScriptDto: UpdateSiteScriptDto,
  ) {
    return this.siteScriptsService.update(id, updateSiteScriptDto);
  }

  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Delete(':id')
  @ApiParam({ name: 'id', type: String, required: true })
  remove(@Param('id') id: string) {
    return this.siteScriptsService.remove(id);
  }
}
