import {
  Body,
  Controller,
  Delete,
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
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import { PartnersService } from './partners.service';
import { PartnerApplyDto } from './dto/partner-apply.dto';
import { UpdatePartnerProfileDto } from './dto/update-partner-profile.dto';
import {
  ConfirmBankAccountChangeDto,
  RequestBankAccountChangeDto,
} from './dto/partner-bank-account.dto';
import { QueryPartnerCommissionDto } from './dto/query-partner.dto';
import { CreatePartnerCouponDto } from './dto/partner-coupon.dto';
import {
  CreateDepositRequestDto,
  CreatePartnerPayoutDto,
} from './dto/admin-partner.dto';
import {
  CreatePartnerLinkDto,
  UpdatePartnerLinkDto,
} from './dto/partner-link.dto';
import { PartnerOrderRowDto } from './dto/partner-order-row.dto';

@ApiTags('Partners')
@Controller({ path: 'partners', version: '1' })
export class PartnersController {
  constructor(private readonly partnersService: PartnersService) {}

  @Post('apply')
  @HttpCode(HttpStatus.CREATED)
  apply(@Body() dto: PartnerApplyDto) {
    return this.partnersService.apply(dto);
  }

  @ApiBearerAuth()
  @Roles(RoleEnum.partner, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Get('me')
  @HttpCode(HttpStatus.OK)
  async getMe(@Request() req: { user: { id: number } }) {
    return this.partnersService.getPartnerByUserId(req.user.id);
  }

  @ApiBearerAuth()
  @Roles(RoleEnum.partner, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Patch('me')
  @HttpCode(HttpStatus.OK)
  async updateMe(
    @Request() req: { user: { id: number } },
    @Body() dto: UpdatePartnerProfileDto,
  ) {
    return this.partnersService.updateMyProfile(req.user.id, dto);
  }

  /** Ask for the code that releases a bank account change (#005). */
  @ApiBearerAuth()
  @Roles(RoleEnum.partner, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post('me/bank-account/otp')
  @HttpCode(HttpStatus.OK)
  async requestBankAccountChange(
    @Request() req: { user: { id: number } },
    @Body() dto: RequestBankAccountChangeDto,
  ) {
    return this.partnersService.requestBankAccountChange(req.user.id, dto);
  }

  /** Apply the requested bank account once the code checks out (#005). */
  @ApiBearerAuth()
  @Roles(RoleEnum.partner, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post('me/bank-account/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmBankAccountChange(
    @Request() req: { user: { id: number } },
    @Body() dto: ConfirmBankAccountChangeDto,
  ) {
    return this.partnersService.confirmBankAccountChange(req.user.id, dto.otp);
  }

  @ApiBearerAuth()
  @Roles(RoleEnum.partner, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Get('me/wallet')
  @HttpCode(HttpStatus.OK)
  async getMyWallet(@Request() req: { user: { id: number } }) {
    const partner = await this.partnersService.getPartnerByUserId(req.user.id);
    return this.partnersService.getWalletSummaryForPartner(partner.id);
  }

  @ApiBearerAuth()
  @Roles(RoleEnum.partner, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Get('me/wallet/transactions')
  @HttpCode(HttpStatus.OK)
  async getMyWalletTransactions(
    @Request() req: { user: { id: number } },
    @Query('limit') limit?: number,
  ) {
    const partner = await this.partnersService.getPartnerByUserId(req.user.id);
    return this.partnersService.getWalletTransactions(
      partner.id,
      Number(limit) || 50,
    );
  }

  @ApiBearerAuth()
  @Roles(RoleEnum.partner, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post('me/wallet/deposit-requests')
  @HttpCode(HttpStatus.CREATED)
  async createDepositRequest(
    @Request() req: { user: { id: number } },
    @Body() dto: CreateDepositRequestDto,
  ) {
    const partner = await this.partnersService.getPartnerByUserId(req.user.id);
    return this.partnersService.createDepositRequest(partner.id, dto);
  }

  @ApiBearerAuth()
  @Roles(RoleEnum.partner, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Get('me/wallet/deposit-requests')
  @HttpCode(HttpStatus.OK)
  async getMyDepositRequests(@Request() req: { user: { id: number } }) {
    const partner = await this.partnersService.getPartnerByUserId(req.user.id);
    return this.partnersService.getMyDepositRequests(partner.id);
  }

  /** Dashboard read model: performance over the chosen period (#010). */
  @ApiBearerAuth()
  @Roles(RoleEnum.partner, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Get('me/summary')
  @HttpCode(HttpStatus.OK)
  async getMySummary(
    @Request() req: { user: { id: number } },
    @Query() query: { from?: string; to?: string },
  ) {
    const partner = await this.partnersService.getPartnerByUserId(req.user.id);
    return this.partnersService.getMySummary(partner.id, {
      from: query.from,
      to: query.to,
    });
  }

  /** Destinations this partner's buyers bought most, for the dashboard (#012). */
  @ApiBearerAuth()
  @Roles(RoleEnum.partner, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Get('me/top-destinations')
  @HttpCode(HttpStatus.OK)
  async getMyTopDestinations(
    @Request() req: { user: { id: number } },
    @Query() query: { from?: string; to?: string; limit?: string },
  ) {
    const partner = await this.partnersService.getPartnerByUserId(req.user.id);
    return this.partnersService.getMyTopDestinations(
      partner.id,
      { from: query.from, to: query.to },
      query.limit ? Number(query.limit) : undefined,
    );
  }

  /** Orders attributed to this partner through their marketing links. */
  @ApiBearerAuth()
  @Roles(RoleEnum.partner, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Get('me/orders')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: [PartnerOrderRowDto] })
  async getMyOrders(
    @Request() req: { user: { id: number } },
    @Query('limit') limit?: string,
  ) {
    const partner = await this.partnersService.getPartnerByUserId(req.user.id);
    const parsed = Number(limit);
    return this.partnersService.getMyOrders(
      partner.id,
      Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 200) : 50,
    );
  }

  /** Weekly tier review history for this partner. */
  @ApiBearerAuth()
  @Roles(RoleEnum.partner, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Get('me/tier-evaluations')
  @HttpCode(HttpStatus.OK)
  async getMyTierEvaluations(@Request() req: { user: { id: number } }) {
    const partner = await this.partnersService.getPartnerByUserId(req.user.id);
    return this.partnersService.getMyTierEvaluations(partner.id);
  }

  /** Discount codes owned by this partner. */
  @ApiBearerAuth()
  @Roles(RoleEnum.partner, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Get('me/coupons')
  @HttpCode(HttpStatus.OK)
  async getMyCoupons(@Request() req: { user: { id: number } }) {
    const partner = await this.partnersService.getPartnerByUserId(req.user.id);
    return this.partnersService.getMyCoupons(partner.id);
  }

  /** Every tier this partner's type can reach, for the benefits comparison. */
  @ApiBearerAuth()
  @Roles(RoleEnum.partner, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Get('me/tiers')
  @HttpCode(HttpStatus.OK)
  async getMyTiers(@Request() req: { user: { id: number } }) {
    const partner = await this.partnersService.getPartnerByUserId(req.user.id);
    return this.partnersService.getMyTiers(partner.id);
  }

  @ApiBearerAuth()
  @Roles(RoleEnum.partner, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Get('me/links')
  @HttpCode(HttpStatus.OK)
  async getMyLinks(@Request() req: { user: { id: number } }) {
    const partner = await this.partnersService.getPartnerByUserId(req.user.id);
    return this.partnersService.getMyLinks(partner.id);
  }

  @ApiBearerAuth()
  @Roles(RoleEnum.partner, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post('me/links')
  @HttpCode(HttpStatus.CREATED)
  async createLink(
    @Request() req: { user: { id: number } },
    @Body() dto: CreatePartnerLinkDto,
  ) {
    const partner = await this.partnersService.getPartnerByUserId(req.user.id);
    return this.partnersService.createLink(partner.id, dto);
  }

  @ApiBearerAuth()
  @Roles(RoleEnum.partner, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  /** Create a discount code funded by this partner's own commission (#028). */
  @ApiBearerAuth()
  @Roles(RoleEnum.partner, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post('me/coupons')
  @HttpCode(HttpStatus.CREATED)
  async createMyCoupon(
    @Request() req: { user: { id: number } },
    @Body() dto: CreatePartnerCouponDto,
  ) {
    const partner = await this.partnersService.getPartnerByUserId(req.user.id);
    return this.partnersService.createMyCoupon(partner.id, dto);
  }

  /** Turn one of the partner's own codes on or off (#028). */
  @ApiBearerAuth()
  @Roles(RoleEnum.partner, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Patch('me/coupons/:id')
  @HttpCode(HttpStatus.OK)
  async setMyCouponActive(
    @Request() req: { user: { id: number } },
    @Param('id') id: number,
    @Body() body: { isActive: boolean },
  ) {
    const partner = await this.partnersService.getPartnerByUserId(req.user.id);
    return this.partnersService.setMyCouponActive(
      partner.id,
      Number(id),
      Boolean(body.isActive),
    );
  }

  /** The partner's orders as a spreadsheet (#027). */
  @ApiBearerAuth()
  @Roles(RoleEnum.partner, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Get('me/orders/export')
  @HttpCode(HttpStatus.OK)
  async exportMyOrders(
    @Request() req: { user: { id: number } },
    @Res() res: Response,
  ): Promise<void> {
    const partner = await this.partnersService.getPartnerByUserId(req.user.id);
    const buffer = await this.partnersService.exportMyOrdersToExcel(partner.id);

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="don-hang-doi-tac-${Date.now()}.xlsx"`,
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }

  /** One attributed order with its attribution timeline (#026). */
  @ApiBearerAuth()
  @Roles(RoleEnum.partner, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Get('me/orders/:orderNumber')
  @HttpCode(HttpStatus.OK)
  async getMyOrderDetail(
    @Request() req: { user: { id: number } },
    @Param('orderNumber') orderNumber: string,
  ) {
    const partner = await this.partnersService.getPartnerByUserId(req.user.id);
    return this.partnersService.getMyOrderDetail(partner.id, orderNumber);
  }

  /** The partner's links as a spreadsheet (#017). */
  @ApiBearerAuth()
  @Roles(RoleEnum.partner, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Get('me/links/export')
  @HttpCode(HttpStatus.OK)
  async exportMyLinks(
    @Request() req: { user: { id: number } },
    @Res() res: Response,
  ): Promise<void> {
    const partner = await this.partnersService.getPartnerByUserId(req.user.id);
    const buffer = await this.partnersService.exportMyLinksToExcel(partner.id);

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="link-tiep-thi-${Date.now()}.xlsx"`,
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }

  /** Remove a link from the partner's list (#016). */
  @ApiBearerAuth()
  @Roles(RoleEnum.partner, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Delete('me/links/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMyLink(
    @Request() req: { user: { id: number } },
    @Param('id') id: number,
  ) {
    const partner = await this.partnersService.getPartnerByUserId(req.user.id);
    await this.partnersService.deleteLink(partner.id, Number(id));
  }

  @Patch('me/links/:id')
  @HttpCode(HttpStatus.OK)
  async updateLink(
    @Request() req: { user: { id: number } },
    @Param('id') id: number,
    @Body() dto: UpdatePartnerLinkDto,
  ) {
    const partner = await this.partnersService.getPartnerByUserId(req.user.id);
    return this.partnersService.updateLink(partner.id, Number(id), dto);
  }

  @ApiBearerAuth()
  @Roles(RoleEnum.partner, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Get('me/commissions')
  @HttpCode(HttpStatus.OK)
  async getMyCommissions(
    @Request() req: { user: { id: number } },
    @Query() query: QueryPartnerCommissionDto,
  ) {
    const partner = await this.partnersService.getPartnerByUserId(req.user.id);
    return this.partnersService.getMyCommissions(partner.id, query);
  }

  @ApiBearerAuth()
  @Roles(RoleEnum.partner, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post('me/payouts')
  @HttpCode(HttpStatus.CREATED)
  async createPayoutRequest(
    @Request() req: { user: { id: number } },
    @Body() dto: CreatePartnerPayoutDto,
  ) {
    const partner = await this.partnersService.getPartnerByUserId(req.user.id);
    return this.partnersService.createPayoutRequest(partner.id, dto);
  }

  @ApiBearerAuth()
  @Roles(RoleEnum.partner, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Get('me/payouts')
  @HttpCode(HttpStatus.OK)
  async getMyPayouts(@Request() req: { user: { id: number } }) {
    const partner = await this.partnersService.getPartnerByUserId(req.user.id);
    return this.partnersService.getMyPayouts(partner.id);
  }
}
