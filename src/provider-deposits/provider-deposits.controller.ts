import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import {
  CreateProviderDepositEntryDto,
  ProviderDepositSummaryDto,
  QueryProviderDepositEntryDto,
  UpdateProviderDepositEntryDto,
} from './dto/provider-deposit.dto';
import { ProviderDepositsService } from './provider-deposits.service';

@ApiTags('ProviderDeposits')
@ApiBearerAuth()
@Roles(RoleEnum.admin)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'provider-deposits', version: '1' })
export class ProviderDepositsController {
  constructor(private readonly service: ProviderDepositsService) {}

  /** Table of suppliers: deposited, spent, expected balance, drift. */
  @ApiOkResponse({ type: [ProviderDepositSummaryDto] })
  @Get('summary')
  @HttpCode(HttpStatus.OK)
  async summary(): Promise<{ data: ProviderDepositSummaryDto[] }> {
    return { data: await this.service.getSummary() };
  }

  /** Ledger entries, newest first; pass `provider` to see just one supplier. */
  @Get('entries')
  @HttpCode(HttpStatus.OK)
  async entries(@Query() query: QueryProviderDepositEntryDto) {
    const [data, totalCount] = await this.service.findEntries({
      provider: query.provider,
      page: query.page ?? 1,
      limit: query.limit ?? 50,
    });

    return { data, totalCount };
  }

  @Post('entries')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateProviderDepositEntryDto) {
    return this.service.createEntry(dto);
  }

  @Patch('entries/:id')
  @HttpCode(HttpStatus.OK)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProviderDepositEntryDto,
  ) {
    return this.service.updateEntry(id, dto);
  }

  @Delete('entries/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.service.removeEntry(id);
  }
}
