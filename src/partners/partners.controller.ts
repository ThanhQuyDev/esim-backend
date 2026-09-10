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
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import { PartnersService } from './partners.service';
import { PartnerApplyDto } from './dto/partner-apply.dto';
import { UpdatePartnerProfileDto } from './dto/update-partner-profile.dto';
import { QueryPartnerCommissionDto } from './dto/query-partner.dto';
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

  /** Dashboard read model: 30-day performance, lifetime totals, tier progress. */
  @ApiBearerAuth()
  @Roles(RoleEnum.partner, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Get('me/summary')
  @HttpCode(HttpStatus.OK)
  async getMySummary(@Request() req: { user: { id: number } }) {
    const partner = await this.partnersService.getPartnerByUserId(req.user.id);
    return this.partnersService.getMySummary(partner.id);
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
