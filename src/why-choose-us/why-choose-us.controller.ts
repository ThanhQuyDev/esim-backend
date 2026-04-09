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
import { WhyChooseUsService } from './why-choose-us.service';
import { CreateWhyChooseUsDto } from './dto/create-why-choose-us.dto';
import { UpdateWhyChooseUsDto } from './dto/update-why-choose-us.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { WhyChooseUs } from './domain/why-choose-us';
import { AuthGuard } from '@nestjs/passport';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { infinityPagination } from '../utils/infinity-pagination';
import { FindAllWhyChooseUsDto } from './dto/find-all-why-choose-us.dto';

@ApiTags('Whychooseus')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'why-choose-us',
  version: '1',
})
export class WhyChooseUsController {
  constructor(private readonly whyChooseUsService: WhyChooseUsService) {}

  @Post()
  @ApiCreatedResponse({
    type: WhyChooseUs,
  })
  create(@Body() createWhyChooseUsDto: CreateWhyChooseUsDto) {
    return this.whyChooseUsService.create(createWhyChooseUsDto);
  }

  @Get()
  @ApiOkResponse({
    type: InfinityPaginationResponse(WhyChooseUs),
  })
  async findAll(
    @Query() query: FindAllWhyChooseUsDto,
  ): Promise<InfinityPaginationResponseDto<WhyChooseUs>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    return infinityPagination(
      await this.whyChooseUsService.findAllWithPagination({
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
    type: WhyChooseUs,
  })
  findById(@Param('id') id: string) {
    return this.whyChooseUsService.findById(id);
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: WhyChooseUs,
  })
  update(
    @Param('id') id: string,
    @Body() updateWhyChooseUsDto: UpdateWhyChooseUsDto,
  ) {
    return this.whyChooseUsService.update(id, updateWhyChooseUsDto);
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  remove(@Param('id') id: string) {
    return this.whyChooseUsService.remove(id);
  }
}
