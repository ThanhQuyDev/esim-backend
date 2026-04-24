import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { UpdateProfitMarginDto } from './dto/update-profit-margin.dto';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { AuthGuard } from '@nestjs/passport';
import { NullableType } from '../utils/types/nullable.type';
import { ProfitMargin } from './domain/profit-margin';
import { ProfitMarginsService } from './profit-margins.service';
import { RolesGuard } from '../roles/roles.guard';

@ApiTags('ProfitMargins')
@ApiBearerAuth()
@Roles(RoleEnum.admin)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'profit-margins', version: '1' })
export class ProfitMarginsController {
  constructor(private readonly profitMarginsService: ProfitMarginsService) {}

  @ApiOkResponse({ type: ProfitMargin })
  @Get()
  @HttpCode(HttpStatus.OK)
  get(): Promise<NullableType<ProfitMargin>> {
    return this.profitMarginsService.getSingleton();
  }

  @ApiOkResponse({ type: ProfitMargin })
  @Put()
  @HttpCode(HttpStatus.OK)
  upsert(@Body() updateDto: UpdateProfitMarginDto): Promise<ProfitMargin> {
    return this.profitMarginsService.upsert(updateDto);
  }
}
