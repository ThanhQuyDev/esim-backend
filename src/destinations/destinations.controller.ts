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
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { CreateDestinationDto } from './dto/create-destination.dto';
import { UpdateDestinationDto } from './dto/update-destination.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { AuthGuard } from '@nestjs/passport';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { NullableType } from '../utils/types/nullable.type';
import { QueryDestinationDto } from './dto/query-destination.dto';
import { Destination } from './domain/destination';
import { DestinationsService } from './destinations.service';
import { RolesGuard } from '../roles/roles.guard';
import { infinityPagination } from '../utils/infinity-pagination';

@ApiTags('Destinations')
@Controller({
  path: 'destinations',
  version: '1',
})
export class DestinationsController {
  constructor(private readonly destinationsService: DestinationsService) {}

  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiCreatedResponse({
    type: Destination,
  })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() createDestinationDto: CreateDestinationDto,
  ): Promise<Destination> {
    return this.destinationsService.create(createDestinationDto);
  }

  @ApiOkResponse({
    type: InfinityPaginationResponse(Destination),
  })
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query() query: QueryDestinationDto,
  ): Promise<InfinityPaginationResponseDto<Destination>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 500) {
      limit = 500;
    }

    const [data, count] = await this.destinationsService.findManyWithPagination(
      {
        filterOptions: query?.filters,
        sortOptions: query?.sort,
        paginationOptions: {
          page,
          limit,
        },
      },
    );

    return infinityPagination(data, { page, limit }, count);
  }

  @ApiOkResponse({
    type: Destination,
  })
  @Get('slug/:slug')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'slug', type: String, required: true })
  findBySlug(
    @Param('slug') slug: Destination['slug'],
  ): Promise<NullableType<Destination>> {
    return this.destinationsService.findBySlug(slug);
  }

  @ApiOkResponse({
    type: Destination,
  })
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  findOne(
    @Param('id') id: Destination['id'],
  ): Promise<NullableType<Destination>> {
    return this.destinationsService.findById(id);
  }

  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiOkResponse({
    type: Destination,
  })
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  update(
    @Param('id') id: Destination['id'],
    @Body() updateDestinationDto: UpdateDestinationDto,
  ): Promise<Destination | null> {
    return this.destinationsService.update(id, updateDestinationDto);
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
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: Destination['id']): Promise<void> {
    return this.destinationsService.remove(id);
  }
}
