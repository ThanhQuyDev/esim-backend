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
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
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
import { QueryPlanDto } from './dto/query-plan.dto';
import { Plan } from './domain/plan';
import { PlansService } from './plans.service';
import { RolesGuard } from '../roles/roles.guard';
import { infinityPagination } from '../utils/infinity-pagination';

@ApiTags('Plans')
@Controller({ path: 'plans', version: '1' })
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiCreatedResponse({ type: Plan })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createPlanDto: CreatePlanDto): Promise<Plan> {
    return this.plansService.create(createPlanDto);
  }

  @ApiOkResponse({ type: InfinityPaginationResponse(Plan) })
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query() query: QueryPlanDto,
  ): Promise<InfinityPaginationResponseDto<Plan>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) limit = 50;

    return infinityPagination(
      await this.plansService.findManyWithPagination({
        filterOptions: query?.filters,
        sortOptions: query?.sort,
        paginationOptions: { page, limit },
      }),
      { page, limit },
    );
  }

  @ApiOkResponse({ type: Plan })
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  findOne(@Param('id') id: Plan['id']): Promise<NullableType<Plan>> {
    return this.plansService.findById(id);
  }

  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiOkResponse({ type: Plan })
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  update(
    @Param('id') id: Plan['id'],
    @Body() updatePlanDto: UpdatePlanDto,
  ): Promise<Plan | null> {
    return this.plansService.update(id, updatePlanDto);
  }

  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Delete(':id')
  @ApiParam({ name: 'id', type: String, required: true })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: Plan['id']): Promise<void> {
    return this.plansService.remove(id);
  }
}
