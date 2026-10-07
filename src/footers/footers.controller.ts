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
} from '@nestjs/common';
import { FootersService } from './footers.service';
import { CreateFooterDto } from './dto/create-footer.dto';
import { UpdateFooterDto } from './dto/update-footer.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Footer } from './domain/footer';
import { AuthGuard } from '@nestjs/passport';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { infinityPagination } from '../utils/infinity-pagination';
import { QueryFooterDto } from './dto/find-all-footers.dto';

import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
@ApiTags('Footers')
@Controller({
  path: 'footers',
  version: '1',
})
export class FootersController {
  constructor(private readonly footersService: FootersService) {}

  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post()
  @ApiCreatedResponse({
    type: Footer,
  })
  create(@Body() createFooterDto: CreateFooterDto) {
    return this.footersService.create(createFooterDto);
  }

  @Get()
  @ApiOkResponse({
    type: InfinityPaginationResponse(Footer),
  })
  async findAll(
    @Query() query: QueryFooterDto,
  ): Promise<InfinityPaginationResponseDto<Footer>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    const filterOptions = {
      ...query?.filters,
      search: query?.search || query?.filters?.search,
      category: query?.category || query?.filters?.category,
    };

    const [data, count] = await this.footersService.findAllWithPagination({
      filterOptions,
      sortOptions: query?.sort,
      paginationOptions: {
        page,
        limit,
      },
    });

    return infinityPagination(data, { page, limit }, count);
  }

  @Get(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: Footer,
  })
  findById(@Param('id') id: string) {
    return this.footersService.findById(id);
  }

  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: Footer,
  })
  update(@Param('id') id: string, @Body() updateFooterDto: UpdateFooterDto) {
    return this.footersService.update(id, updateFooterDto);
  }

  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  remove(@Param('id') id: string) {
    return this.footersService.remove(id);
  }
}
