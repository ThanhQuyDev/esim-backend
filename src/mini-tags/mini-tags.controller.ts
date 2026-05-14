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
import { MiniTagsService } from './mini-tags.service';
import { CreateMiniTagDto } from './dto/create-mini-tag.dto';
import { UpdateMiniTagDto } from './dto/update-mini-tag.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { MiniTag } from './domain/mini-tag';
import { AuthGuard } from '@nestjs/passport';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { infinityPagination } from '../utils/infinity-pagination';
import { FindAllMiniTagsDto } from './dto/find-all-mini-tags.dto';

@ApiTags('MiniTags')
@Controller({
  path: 'mini-tags',
  version: '1',
})
export class MiniTagsController {
  constructor(private readonly miniTagsService: MiniTagsService) {}

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post()
  @ApiCreatedResponse({
    type: MiniTag,
  })
  create(@Body() createMiniTagDto: CreateMiniTagDto) {
    return this.miniTagsService.create(createMiniTagDto);
  }

  @Get()
  @ApiOkResponse({
    type: InfinityPaginationResponse(MiniTag),
  })
  async findAll(
    @Query() query: FindAllMiniTagsDto,
  ): Promise<InfinityPaginationResponseDto<MiniTag>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    const [data, count] = await this.miniTagsService.findAllWithPagination({
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
    type: MiniTag,
  })
  findById(@Param('id') id: string) {
    return this.miniTagsService.findById(id);
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
    type: MiniTag,
  })
  update(@Param('id') id: string, @Body() updateMiniTagDto: UpdateMiniTagDto) {
    return this.miniTagsService.update(id, updateMiniTagDto);
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
    return this.miniTagsService.remove(id);
  }
}
