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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { MenuSlidesService } from './menu-slides.service';
import { CreateMenuSlideDto } from './dto/create-menu-slide.dto';
import { UpdateMenuSlideDto } from './dto/update-menu-slide.dto';
import { FindAllMenuSlidesDto } from './dto/find-all-menu-slides.dto';
import { MenuSlide } from './domain/menu-slide';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { infinityPagination } from '../utils/infinity-pagination';

@ApiTags('MenuSlides')
@Controller({
  path: 'menu-slides',
  version: '1',
})
export class MenuSlidesController {
  constructor(private readonly menuSlidesService: MenuSlidesService) {}

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post()
  @ApiCreatedResponse({ type: MenuSlide })
  create(@Body() createMenuSlideDto: CreateMenuSlideDto) {
    return this.menuSlidesService.create(createMenuSlideDto);
  }

  @Get()
  @ApiHeader({
    name: 'x-custom-lang',
    required: false,
    description: 'Language filter: en or vi. If not provided, returns all.',
  })
  @ApiOkResponse({ type: InfinityPaginationResponse(MenuSlide) })
  async findAll(
    @Query() query: FindAllMenuSlidesDto,
    @Headers('x-custom-lang') lang?: string,
  ): Promise<InfinityPaginationResponseDto<MenuSlide>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    const [data, count] = await this.menuSlidesService.findAllWithPagination({
      paginationOptions: { page, limit },
      lang,
      menuKey: query?.menuKey,
    });

    return infinityPagination(data, { page, limit }, count);
  }

  /**
   * Every active slide for one language, grouped by panel — what the storefront
   * navbar needs in a single request.
   *
   * Declared before `:id` so "grouped" is not read as a slide id.
   */
  @Get('grouped')
  @ApiHeader({
    name: 'x-custom-lang',
    required: false,
    description: 'Language of the slides to return: en or vi.',
  })
  findGrouped(@Headers('x-custom-lang') lang?: string) {
    return this.menuSlidesService.findGrouped(lang);
  }

  @Get(':id')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: MenuSlide })
  async findById(@Param('id') id: string) {
    const slide = await this.menuSlidesService.findById(id);
    if (!slide) {
      throw new NotFoundException('Menu slide not found');
    }
    return slide;
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Patch(':id')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: MenuSlide })
  update(
    @Param('id') id: string,
    @Body() updateMenuSlideDto: UpdateMenuSlideDto,
  ) {
    return this.menuSlidesService.update(id, updateMenuSlideDto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  @ApiParam({ name: 'id', type: String, required: true })
  remove(@Param('id') id: string) {
    return this.menuSlidesService.remove(id);
  }
}
