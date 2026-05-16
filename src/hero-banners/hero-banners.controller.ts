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
} from '@nestjs/common';
import { HeroBannersService } from './hero-banners.service';
import { CreateHeroBannerDto } from './dto/create-hero-banner.dto';
import { UpdateHeroBannerDto } from './dto/update-hero-banner.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
  ApiHeader,
} from '@nestjs/swagger';
import { HeroBanner } from './domain/hero-banner';
import { AuthGuard } from '@nestjs/passport';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { infinityPagination } from '../utils/infinity-pagination';
import { QueryHeroBannerDto } from './dto/find-all-hero-banners.dto';

@ApiTags('Herobanners')
@Controller({
  path: 'hero-banners',
  version: '1',
})
export class HeroBannersController {
  constructor(private readonly heroBannersService: HeroBannersService) {}

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post()
  @ApiCreatedResponse({
    type: HeroBanner,
  })
  create(@Body() createHeroBannerDto: CreateHeroBannerDto) {
    return this.heroBannersService.create(createHeroBannerDto);
  }

  @Get()
  @ApiHeader({
    name: 'x-custom-lang',
    required: false,
    description: 'Language filter: en or vi. If not provided, returns all.',
  })
  @ApiOkResponse({
    type: InfinityPaginationResponse(HeroBanner),
  })
  async findAll(
    @Query() query: QueryHeroBannerDto,
    @Headers('x-custom-lang') lang?: string,
  ): Promise<InfinityPaginationResponseDto<HeroBanner>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    const filterOptions = {
      ...query?.filters,
      search: query?.search || query?.filters?.search,
    };

    const [data, count] = await this.heroBannersService.findAllWithPagination({
      filterOptions,
      sortOptions: query?.sort,
      paginationOptions: {
        page,
        limit,
      },
      lang,
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
    type: HeroBanner,
  })
  findById(@Param('id') id: string) {
    return this.heroBannersService.findById(id);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: HeroBanner,
  })
  update(
    @Param('id') id: string,
    @Body() updateHeroBannerDto: UpdateHeroBannerDto,
  ) {
    return this.heroBannersService.update(id, updateHeroBannerDto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  remove(@Param('id') id: string) {
    return this.heroBannersService.remove(id);
  }
}
