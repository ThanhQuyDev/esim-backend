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
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import { PartnersService } from './partners.service';
import { AdminCreatePartnerDto } from './dto/partner-apply.dto';
import { CreatePartnerLinkDto } from './dto/partner-link.dto';
import { ReviewEsimFaultDto } from './dto/partner-esim-fault.dto';
import {
  QueryPartnerDto,
  QueryPartnerCommissionDto,
} from './dto/query-partner.dto';
import {
  AdjustPartnerWalletDto,
  AssignPartnerTierDto,
  ProcessPartnerPayoutDto,
  RejectPartnerDto,
  BulkPartnerStatusDto,
  UpdatePartnerAdminNoteDto,
  UpdatePartnerProfileByAdminDto,
  UpdateReconciliationStatusDto,
  UpdatePartnerProgramSettingDto,
  CreatePartnerNotificationDto,
  QueryPartnerPayoutDto,
  BulkPayoutDecisionDto,
  UpdatePartnerAffiliateGrantDto,
  UpdatePartnerLinkCodePermissionDto,
  UpdatePartnerStatusDto,
} from './dto/admin-partner.dto';
import {
  CreatePartnerTierDto,
  UpdatePartnerTierDto,
} from './dto/partner-tier.dto';
import { PartnerDepositRequestStatusEnum } from './partners.enum';

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
   * What esim.vn keeps from each kind of partner, over a period (#050).
   */
  /** Revenue and orders over time, split by partner type (#052). */
  @Get('series-by-type')
  @HttpCode(HttpStatus.OK)
  adminPartnerSeries(
    @Query()
    query: {
      from?: string;
      to?: string;
      groupBy?: 'day' | 'week' | 'month' | 'year';
    },
  ) {
    return this.partnersService.adminPartnerSeries(
      { from: query.from, to: query.to },
      query.groupBy,
    );
  }

  /** The partner list as a spreadsheet, with the screen's filters (#062). */
  @Get('export-excel')
  @HttpCode(HttpStatus.OK)
  async exportPartners(
    @Query() query: QueryPartnerDto,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.partnersService.adminExportPartnersToExcel(query);
    const stamp = new Date().toISOString().slice(0, 10);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="danh-sach-doi-tac-${stamp}.xlsx"`,
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }

  /** The reconciliation list: one row per partner for one period (#065). */
  @Get('reconciliations')
  @HttpCode(HttpStatus.OK)
  adminListReconciliations(
    @Query() query: { period?: string; search?: string; status?: string },
  ) {
    return this.partnersService.adminListReconciliations(query);
  }

  /** Sign off (or hold) one or more statements (#065). */
  @Patch('reconciliations/status')
  @HttpCode(HttpStatus.OK)
  adminSetReconciliationStatus(
    @Request() req: { user: { id: number } },
    @Body() dto: UpdateReconciliationStatusDto,
  ) {
    return this.partnersService.adminSetReconciliationStatus(dto, req.user.id);
  }

  /** The reconciliation list as a spreadsheet (#066). */
  @Get('reconciliations/export-excel')
  @HttpCode(HttpStatus.OK)
  async exportReconciliations(
    @Query() query: { period?: string; search?: string; status?: string },
    @Res() res: Response,
  ): Promise<void> {
    const buffer =
      await this.partnersService.adminExportReconciliationsToExcel(query);
    const period = query.period || new Date().toISOString().slice(0, 7);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="doi-soat-hoa-hong-${period}.xlsx"`,
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }

  /** The five figures at the head of "Hoa hồng & Đối soát" (#063). */
  @Get('commission-summary')
  @HttpCode(HttpStatus.OK)
  adminCommissionSummary() {
    return this.partnersService.adminCommissionSummary();
  }

  /** The four figures at the head of the partner list (#057). */
  @Get('list-stats')
  @HttpCode(HttpStatus.OK)
  adminPartnerListStats() {
    return this.partnersService.adminPartnerListStats();
  }

  /** The partners bringing in the most, for the foot of the overview (#054). */
  @Get('top-partners')
  @HttpCode(HttpStatus.OK)
  adminTopPartners(
    @Query() query: { from?: string; to?: string; limit?: string },
  ) {
    return this.partnersService.adminTopPartners(
      { from: query.from, to: query.to },
      query.limit ? Number(query.limit) : undefined,
    );
  }

  /** Where partner-driven orders are going (#052). */
  @Get('top-destinations')
  @HttpCode(HttpStatus.OK)
  adminPartnerTopDestinations(
    @Query() query: { from?: string; to?: string; limit?: string },
  ) {
    return this.partnersService.adminPartnerTopDestinations(
      { from: query.from, to: query.to },
      query.limit ? Number(query.limit) : undefined,
    );
  }

  /** Orders, live partners and what is waiting to be settled (#051). */
  @Get('activity-by-type')
  @HttpCode(HttpStatus.OK)
  adminPartnerActivity(@Query() query: { from?: string; to?: string }) {
    return this.partnersService.adminPartnerActivity({
      from: query.from,
      to: query.to,
    });
  }

  @Get('revenue-by-type')
  @HttpCode(HttpStatus.OK)
  adminRevenueByPartnerType(@Query() query: { from?: string; to?: string }) {
    return this.partnersService.adminRevenueByPartnerType({
      from: query.from,
      to: query.to,
    });
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

  /** Compose and send an announcement to partners (#079). */
  @Post('notifications')
  @HttpCode(HttpStatus.CREATED)
  createNotification(
    @Body() dto: CreatePartnerNotificationDto,
    @Request() req: { user: { id: number } },
  ) {
    return this.partnersService.adminCreateNotification(dto, req.user.id);
  }

  /** Everything that has been sent, with how far it reached (#079). */
  @Get('notifications')
  @HttpCode(HttpStatus.OK)
  listNotifications(@Query('limit') limit?: number) {
    return this.partnersService.adminListNotifications(Number(limit) || 50);
  }

  /** The partner programme's settings (#075, #076, #077). */
  @Get('program-settings')
  @HttpCode(HttpStatus.OK)
  getProgramSettings() {
    return this.partnersService.getProgramSettings();
  }

  @Patch('program-settings')
  @HttpCode(HttpStatus.OK)
  updateProgramSettings(
    @Body() dto: UpdatePartnerProgramSettingDto,
    @Request() req: { user: { id: number } },
  ) {
    return this.partnersService.updateProgramSettings(dto, req.user.id);
  }

  /** "Đơn hàng đối tác": the partner screens, with the scope opened up (#071). */
  @Get('orders')
  @HttpCode(HttpStatus.OK)
  listPartnerOrders(
    @Query()
    query: {
      partnerType?: string;
      partnerId?: number;
      search?: string;
      status?: string;
      limit?: number;
    },
  ) {
    return this.partnersService.adminListPartnerOrders(query);
  }

  /** The names for the "lọc theo đối tác" select box (#071). */
  @Get('orders/partner-options')
  @HttpCode(HttpStatus.OK)
  partnerOptions(@Query('partnerType') partnerType?: string) {
    return this.partnersService.adminPartnerOptions(partnerType);
  }

  /** The admin's partner-order list as a spreadsheet (#071). */
  @Get('orders/export-excel')
  @HttpCode(HttpStatus.OK)
  async exportPartnerOrders(
    @Query()
    query: {
      partnerType?: string;
      partnerId?: number;
      search?: string;
      status?: string;
    },
    @Res() res: Response,
  ): Promise<void> {
    const buffer =
      await this.partnersService.adminExportPartnerOrdersToExcel(query);
    const stamp = new Date().toISOString().slice(0, 10);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="don-hang-doi-tac-${stamp}.xlsx"`,
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }

  /** The four figures at the head of "Tài chính" (#067). */
  @Get('payouts/summary')
  @HttpCode(HttpStatus.OK)
  adminPayoutSummary() {
    return this.partnersService.adminPayoutSummary();
  }

  /** The withdrawal list as a spreadsheet (#070). */
  @Get('payouts/export-excel')
  @HttpCode(HttpStatus.OK)
  async exportPayouts(
    @Query() query: QueryPartnerPayoutDto,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.partnersService.adminExportPayoutsToExcel(query);
    const stamp = new Date().toISOString().slice(0, 10);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="yeu-cau-rut-tien-${stamp}.xlsx"`,
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }

  /** "Duyệt chi" or "Từ chối" for the rows an admin ticked (#069). */
  @Patch('payouts/bulk-decision')
  @HttpCode(HttpStatus.OK)
  bulkPayoutDecision(
    @Body() dto: BulkPayoutDecisionDto,
    @Request() req: { user: { id: number } },
  ) {
    return this.partnersService.adminBulkPayoutDecision(dto, req.user.id);
  }

  @Get('payouts')
  @HttpCode(HttpStatus.OK)
  listPayouts(@Query() query: QueryPartnerPayoutDto) {
    return this.partnersService.adminListPayouts(query);
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

  /**
   * Phiếu đối tác báo eSIM lỗi, chờ duyệt (#046).
   *
   * Phải đứng **trước** `@Get(':id')`, nếu không "esim-faults" sẽ bị khớp vào
   * đó như một id đối tác và trả về 404 khó hiểu.
   */
  @Get('esim-faults')
  @HttpCode(HttpStatus.OK)
  listEsimFaults(@Query() query: { status?: string; limit?: string }) {
    return this.partnersService.getEsimFaultReports(null, {
      status: query.status,
      limit: query.limit ? Number(query.limit) : undefined,
    });
  }

  /** Duyệt hoặc từ chối một phiếu; duyệt thì tiền về ví ngay (#046). */
  @Patch('esim-faults/:reportId')
  @HttpCode(HttpStatus.OK)
  reviewEsimFault(
    @Param('reportId') reportId: number,
    @Body() dto: ReviewEsimFaultDto,
    @Request() req: { user: { id: number } },
  ) {
    return this.partnersService.reviewEsimFaultReport(
      Number(reportId),
      req.user.id,
      {
        approve: dto.approve,
        refundVnd: dto.refundVnd,
        adminNote: dto.adminNote,
      },
    );
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
  updateStatus(
    @Request() req: { user: { id: number } },
    @Param('id') id: number,
    @Body() dto: UpdatePartnerStatusDto & { reason?: string },
  ) {
    return this.partnersService.updateStatus(
      Number(id),
      dto,
      req.user.id,
      dto.reason,
    );
  }

  /** Tick/untick "được đặt tên link tiếp thị" for this partner (#014). */
  @Patch(':id/link-code-permission')
  @HttpCode(HttpStatus.OK)
  setLinkCodePermission(
    @Param('id') id: number,
    @Body() dto: UpdatePartnerLinkCodePermissionDto,
  ) {
    return this.partnersService.setLinkCodePermission(
      Number(id),
      dto.canCustomLinkCode,
    );
  }

  /**
   * Create a partner account by hand (#059).
   *
   * For partners signed over the phone who cannot be asked to fill in the form
   * and wait: the admin gives the details, the system mints the password.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  adminCreatePartner(
    @Request() req: { user: { id: number } },
    @Body() dto: AdminCreatePartnerDto,
  ) {
    return this.partnersService.adminCreatePartner(dto, req.user.id);
  }

  /** Change several partners' status at once (#059). */
  @Patch('bulk-status')
  @HttpCode(HttpStatus.OK)
  bulkUpdateStatus(
    @Request() req: { user: { id: number } },
    @Body() dto: BulkPartnerStatusDto,
  ) {
    return this.partnersService.bulkUpdateStatus(dto, req.user.id);
  }

  /** A partner's status history, with the reason each time (#060). */
  @Get(':id/status-history')
  @HttpCode(HttpStatus.OK)
  getStatusHistory(@Param('id') id: number) {
    return this.partnersService.getStatusHistory(Number(id));
  }

  /**
   * Contract details and this partner's own deposit limits (#061) — the
   * detail screen's "Lưu lại".
   */
  @Patch(':id/profile')
  @HttpCode(HttpStatus.OK)
  updatePartnerByAdmin(
    @Param('id') id: number,
    @Body() dto: UpdatePartnerProfileByAdminDto,
  ) {
    return this.partnersService.updatePartnerByAdmin(Number(id), dto);
  }

  /** Link and code performance over the last 30 days (#061). */
  @Get(':id/performance')
  @HttpCode(HttpStatus.OK)
  adminPartnerPerformance(@Param('id') id: number) {
    return this.partnersService.adminPartnerPerformance(Number(id));
  }

  /** Create a marketing link on a partner's behalf (#061). */
  @Post(':id/links')
  @HttpCode(HttpStatus.CREATED)
  adminCreateLinkForPartner(
    @Param('id') id: number,
    @Body() dto: CreatePartnerLinkDto,
  ) {
    return this.partnersService.adminCreateLinkForPartner(Number(id), dto);
  }

  /** Record an admin's own note on this partner (#056). */
  @Patch(':id/admin-note')
  @HttpCode(HttpStatus.OK)
  setAdminNote(
    @Param('id') id: number,
    @Body() dto: UpdatePartnerAdminNoteDto,
  ) {
    return this.partnersService.setAdminNote(Number(id), dto.adminNote);
  }

  /** Tick/untick "được phân quyền affiliate" for this partner (#048). */
  @Patch(':id/affiliate-grant')
  @HttpCode(HttpStatus.OK)
  setAffiliateGrant(
    @Param('id') id: number,
    @Body() dto: UpdatePartnerAffiliateGrantDto,
  ) {
    return this.partnersService.setAffiliateGrant(Number(id), dto.canAffiliate);
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
