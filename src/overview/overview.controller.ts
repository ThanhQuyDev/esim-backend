import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import {
  FinancialComparisonQueryDto,
  FinancialComparisonResponseDto,
  OverviewProviderFilterQueryDto,
  OverviewResponseDto,
  OverviewSummaryResponseDto,
  ProviderComparisonQueryDto,
  ProviderComparisonResponseDto,
  TopDestinationsQueryDto,
  TopDestinationsResponseDto,
} from './dto/overview.dto';
import { OverviewService } from './overview.service';

@ApiBearerAuth()
@Roles(RoleEnum.admin)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiTags('Overview')
@Controller({ path: 'overview', version: '1' })
export class OverviewController {
  constructor(private readonly overviewService: OverviewService) {}

  @ApiOperation({ summary: 'Get all overview dashboard blocks' })
  @ApiOkResponse({ type: OverviewResponseDto })
  @Get()
  @HttpCode(HttpStatus.OK)
  getOverview(
    @Query() query: OverviewProviderFilterQueryDto,
  ): Promise<OverviewResponseDto> {
    return this.overviewService.getOverview(query);
  }

  @ApiOperation({ summary: 'Get overview KPI summary cards' })
  @ApiOkResponse({ type: OverviewSummaryResponseDto })
  @Get('summary')
  @HttpCode(HttpStatus.OK)
  getSummary(
    @Query() query: OverviewProviderFilterQueryDto,
  ): Promise<OverviewSummaryResponseDto> {
    return this.overviewService.getSummary(query);
  }

  @ApiOperation({ summary: 'Get provider comparison chart data' })
  @ApiOkResponse({ type: ProviderComparisonResponseDto })
  @Get('provider-comparison')
  @HttpCode(HttpStatus.OK)
  getProviderComparison(
    @Query() query: ProviderComparisonQueryDto,
  ): Promise<ProviderComparisonResponseDto> {
    return this.overviewService.getProviderComparison(query);
  }

  @ApiOperation({ summary: 'Get top destinations by purchased plans' })
  @ApiOkResponse({ type: TopDestinationsResponseDto })
  @Get('top-destinations')
  @HttpCode(HttpStatus.OK)
  getTopDestinations(
    @Query() query: TopDestinationsQueryDto,
  ): Promise<TopDestinationsResponseDto> {
    return this.overviewService.getTopDestinations(query);
  }

  @ApiOperation({ summary: 'Get financial comparison chart data' })
  @ApiOkResponse({ type: FinancialComparisonResponseDto })
  @Get('financial-comparison')
  @HttpCode(HttpStatus.OK)
  getFinancialComparison(
    @Query() query: FinancialComparisonQueryDto,
  ): Promise<FinancialComparisonResponseDto> {
    return this.overviewService.getFinancialComparison(query);
  }
}
