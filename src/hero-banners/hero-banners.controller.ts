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
import { HeroBannersService } from './hero-banners.service';
import { CreateHeroBannerDto } from './dto/create-hero-banner.dto';
import { UpdateHeroBannerDto } from './dto/update-hero-banner.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { HeroBanner } from './domain/hero-banner';
import { AuthGuard } from '@nestjs/passport';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { infinityPagination } from '../utils/infinity-pagination';
import { FindAllHeroBannersDto } from './dto/find-all-hero-banners.dto';

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
  @ApiOkResponse({
    type: InfinityPaginationResponse(HeroBanner),
  })
  async findAll(
    @Query() query: FindAllHeroBannersDto,
  ): Promise<InfinityPaginationResponseDto<HeroBanner>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    return infinityPagination(
      await this.heroBannersService.findAllWithPagination({
        paginationOptions: {
          page,
          limit,
        },
      }),
      { page, limit },
    );
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
