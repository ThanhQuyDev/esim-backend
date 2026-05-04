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
import { TopBarsService } from './top-bars.service';
import { CreateTopBarDto } from './dto/create-top-bar.dto';
import { UpdateTopBarDto } from './dto/update-top-bar.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { TopBar } from './domain/top-bar';
import { AuthGuard } from '@nestjs/passport';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { infinityPagination } from '../utils/infinity-pagination';
import { FindAllTopBarsDto } from './dto/find-all-top-bars.dto';

@ApiTags('Topbars')
@Controller({
  path: 'top-bars',
  version: '1',
})
export class TopBarsController {
  constructor(private readonly topBarsService: TopBarsService) {}

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post()
  @ApiCreatedResponse({
    type: TopBar,
  })
  create(@Body() createTopBarDto: CreateTopBarDto) {
    return this.topBarsService.create(createTopBarDto);
  }

  @Get()
  @ApiOkResponse({
    type: InfinityPaginationResponse(TopBar),
  })
  async findAll(
    @Query() query: FindAllTopBarsDto,
  ): Promise<InfinityPaginationResponseDto<TopBar>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    return infinityPagination(
      await this.topBarsService.findAllWithPagination({
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
    type: TopBar,
  })
  findById(@Param('id') id: string) {
    return this.topBarsService.findById(id);
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
    type: TopBar,
  })
  update(@Param('id') id: string, @Body() updateTopBarDto: UpdateTopBarDto) {
    return this.topBarsService.update(id, updateTopBarDto);
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
    return this.topBarsService.remove(id);
  }
}
