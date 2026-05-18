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
import { FaqsService } from './faqs.service';
import { CreateFaqDto } from './dto/create-faq.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Faq } from './domain/faq';
import { AuthGuard } from '@nestjs/passport';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { infinityPagination } from '../utils/infinity-pagination';
import { FindAllFaqsDto } from './dto/find-all-faqs.dto';

@ApiTags('Faqs')
@Controller({
  path: 'faqs',
  version: '1',
})
export class FaqsController {
  constructor(private readonly faqsService: FaqsService) {}

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post()
  @ApiCreatedResponse({
    type: Faq,
  })
  create(@Body() createFaqDto: CreateFaqDto) {
    return this.faqsService.create(createFaqDto);
  }

  @Get('by-context')
  @ApiOkResponse({
    type: [Faq],
    description:
      'Get FAQs by url or blogId. Auto-fills to 6 items with random FAQs if not enough.',
  })
  async findByContext(
    @Query('url') url?: string,
    @Query('blogId') blogId?: string,
    @Query('language') language?: string,
    @Query('limit') limit?: string,
  ): Promise<Faq[]> {
    return this.faqsService.findByUrlOrBlogId({
      url,
      blogId,
      language,
      limit: limit ? Number(limit) : 6,
    });
  }

  @Get()
  @ApiOkResponse({
    type: InfinityPaginationResponse(Faq),
  })
  async findAll(
    @Query() query: FindAllFaqsDto,
  ): Promise<InfinityPaginationResponseDto<Faq>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    const [data, count] = await this.faqsService.findAllWithPagination({
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
    type: Faq,
  })
  findById(@Param('id') id: string) {
    return this.faqsService.findById(id);
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
    type: Faq,
  })
  update(@Param('id') id: string, @Body() updateFaqDto: UpdateFaqDto) {
    return this.faqsService.update(id, updateFaqDto);
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
    return this.faqsService.remove(id);
  }
}
