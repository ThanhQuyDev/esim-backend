import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import { PartnersService } from './partners.service';
import {
  QueryPartnerDto,
  QueryPartnerCommissionDto,
} from './dto/query-partner.dto';
import {
  AdjustPartnerWalletDto,
  AssignPartnerTierDto,
  ProcessPartnerPayoutDto,
  RejectPartnerDto,
  UpdatePartnerStatusDto,
} from './dto/admin-partner.dto';
import {
  CreatePartnerTierDto,
  UpdatePartnerTierDto,
} from './dto/partner-tier.dto';
import {
  PartnerDepositRequestStatusEnum,
  PartnerPayoutStatusEnum,
} from './partners.enum';

@ApiTags('Admin Partners')
@ApiBearerAuth()
@Roles(RoleEnum.admin)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'admin/partners', version: '1' })
export class AdminPartnersController {
  constructor(private readonly partnersService: PartnersService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  list(@Query() query: QueryPartnerDto) {
    return this.partnersService.adminList(query);
  }

  /** Aggregates behind the admin partner overview screen. */
  @Get('overview')
  @HttpCode(HttpStatus.OK)
  adminOverview() {
    return this.partnersService.adminOverview();
  }

  /**
   * Run the weekly tier review now. Same code path as the Sunday cron — useful
   * after changing tier thresholds, or to re-check a partner who just crossed one.
   */
  @Post('tier-review')
  @HttpCode(HttpStatus.OK)
  async runTierReview() {
    await this.partnersService.runWeeklyTierReview();
    return { success: true };
  }

  @Get('deposit-requests')
  @HttpCode(HttpStatus.OK)
  listDepositRequests(
    @Query('status') status?: PartnerDepositRequestStatusEnum,
  ) {
    return this.partnersService.adminListDepositRequests(status);
  }

  @Post('deposit-requests/:id/confirm')
  @HttpCode(HttpStatus.OK)
  confirmDepositRequest(
    @Param('id') id: number,
    @Request() req: { user: { id: number } },
  ) {
    return this.partnersService.confirmDepositRequest(Number(id), req.user.id);
  }

  @Get('commissions')
  @HttpCode(HttpStatus.OK)
  listCommissions(@Query() query: QueryPartnerCommissionDto) {
    return this.partnersService.adminListCommissions(query);
  }

  @Get('payouts')
  @HttpCode(HttpStatus.OK)
  listPayouts(@Query('status') status?: PartnerPayoutStatusEnum) {
    return this.partnersService.adminListPayouts(status);
  }

  @Post('payouts/:id/approve')
  @HttpCode(HttpStatus.OK)
  approvePayout(
    @Param('id') id: number,
    @Request() req: { user: { id: number } },
  ) {
    return this.partnersService.approvePayout(Number(id), req.user.id);
  }

  @Post('payouts/:id/reject')
  @HttpCode(HttpStatus.OK)
  rejectPayout(
    @Param('id') id: number,
    @Body() dto: ProcessPartnerPayoutDto,
    @Request() req: { user: { id: number } },
  ) {
    return this.partnersService.rejectPayout(
      Number(id),
      dto.adminNote,
      req.user.id,
    );
  }

  @Post('payouts/:id/mark-paid')
  @HttpCode(HttpStatus.OK)
  markPayoutPaid(
    @Param('id') id: number,
    @Body() dto: ProcessPartnerPayoutDto,
    @Request() req: { user: { id: number } },
  ) {
    return this.partnersService.markPayoutPaid(
      Number(id),
      dto.adminNote,
      req.user.id,
    );
  }

  @Get('tiers')
  @HttpCode(HttpStatus.OK)
  listTiers() {
    return this.partnersService.findAllTiers();
  }

  @Post('tiers')
  @HttpCode(HttpStatus.CREATED)
  createTier(@Body() dto: CreatePartnerTierDto) {
    return this.partnersService.createTier(dto);
  }

  @Patch('tiers/:id')
  @HttpCode(HttpStatus.OK)
  updateTier(@Param('id') id: number, @Body() dto: UpdatePartnerTierDto) {
    return this.partnersService.updateTier(Number(id), dto);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  findOne(@Param('id') id: number) {
    return this.partnersService.adminFindById(Number(id));
  }

  /** Marketing links and discount codes this partner has created (#095). */
  @Get(':id/marketing')
  @HttpCode(HttpStatus.OK)
  marketing(@Param('id') id: number) {
    return this.partnersService.adminGetPartnerMarketing(Number(id));
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  approve(@Param('id') id: number, @Request() req: { user: { id: number } }) {
    return this.partnersService.approve(Number(id), req.user.id);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  reject(
    @Param('id') id: number,
    @Body() dto: RejectPartnerDto,
    @Request() req: { user: { id: number } },
  ) {
    return this.partnersService.reject(Number(id), dto, req.user.id);
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  updateStatus(@Param('id') id: number, @Body() dto: UpdatePartnerStatusDto) {
    return this.partnersService.updateStatus(Number(id), dto);
  }

  @Patch(':id/tier')
  @HttpCode(HttpStatus.OK)
  assignTier(@Param('id') id: number, @Body() dto: AssignPartnerTierDto) {
    return this.partnersService.assignTier(Number(id), dto);
  }

  @Post(':id/wallet/adjust')
  @HttpCode(HttpStatus.OK)
  adjustWallet(
    @Param('id') id: number,
    @Body() dto: AdjustPartnerWalletDto,
    @Request() req: { user: { id: number } },
  ) {
    return this.partnersService.adjustWallet(Number(id), dto, req.user.id);
  }
}
