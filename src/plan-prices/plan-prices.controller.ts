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
import { CreatePlanPriceDto } from './dto/create-plan-price.dto';
import { UpdatePlanPriceDto } from './dto/update-plan-price.dto';
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
import { QueryPlanPriceDto } from './dto/query-plan-price.dto';
import { PlanPrice } from './domain/plan-price';
import { PlanPricesService } from './plan-prices.service';
import { RolesGuard } from '../roles/roles.guard';
import { infinityPagination } from '../utils/infinity-pagination';

@ApiTags('PlanPrices')
@Controller({
  path: 'plan-prices',
  version: '1',
})
export class PlanPricesController {
  constructor(private readonly planPricesService: PlanPricesService) {}

  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiCreatedResponse({
    type: PlanPrice,
  })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createPlanPriceDto: CreatePlanPriceDto): Promise<PlanPrice> {
    return this.planPricesService.create(createPlanPriceDto);
  }

  @ApiOkResponse({
    type: InfinityPaginationResponse(PlanPrice),
  })
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query() query: QueryPlanPriceDto,
  ): Promise<InfinityPaginationResponseDto<PlanPrice>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    const [data, count] = await this.planPricesService.findManyWithPagination({
      filterOptions: query?.filters,
      sortOptions: query?.sort,
      paginationOptions: {
        page,
        limit,
      },
    });

    return infinityPagination(data, { page, limit }, count);
  }

  @ApiOkResponse({
    type: PlanPrice,
  })
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  findOne(@Param('id') id: PlanPrice['id']): Promise<NullableType<PlanPrice>> {
    return this.planPricesService.findById(id);
  }

  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiOkResponse({
    type: PlanPrice,
  })
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  update(
    @Param('id') id: PlanPrice['id'],
    @Body() updatePlanPriceDto: UpdatePlanPriceDto,
  ): Promise<PlanPrice | null> {
    return this.planPricesService.update(id, updatePlanPriceDto);
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
  remove(@Param('id') id: PlanPrice['id']): Promise<void> {
    return this.planPricesService.remove(id);
  }
}
