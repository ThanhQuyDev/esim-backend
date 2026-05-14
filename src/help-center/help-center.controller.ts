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
import { HelpCenterService } from './help-center.service';
import { CreateHelpCenterDto } from './dto/create-help-center.dto';
import { UpdateHelpCenterDto } from './dto/update-help-center.dto';
import { FindAllHelpCenterDto } from './dto/find-all-help-center.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { HelpCenter } from './domain/help-center';
import { AuthGuard } from '@nestjs/passport';
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

  @Get()
  @ApiOkResponse({ type: InfinityPaginationResponse(HelpCenter) })
  async findAll(
    @Query() query: FindAllHelpCenterDto,
  ): Promise<InfinityPaginationResponseDto<HelpCenter>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) limit = 50;

    const [data, count] = await this.helpCenterService.findAllWithPagination({
      paginationOptions: { page, limit },
      category: query.category,
      parent: query.parent,
    });

    return infinityPagination(data, { page, limit }, count);
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
