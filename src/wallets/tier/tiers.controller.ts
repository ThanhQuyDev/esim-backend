import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MembershipTierConfigService } from './membership-tier-config.service';
import { MembershipTierDto } from './membership-tier.dto';

/**
 * The whole membership ladder, lowest tier first (#061).
 *
 * The profile page shows every level — the ones reached and the ones still
 * locked — so it needs the full table, not just the customer's current tier.
 * Served from the same table the cashback and referral payouts use (editable in
 * the CMS since #024), so the page can never advertise a benefit the system
 * does not actually pay.
 *
 * Public on purpose: it is marketing information, and nothing here is per-user.
 */
@ApiTags('Wallets')
@Controller({ path: 'membership-tiers', version: '1' })
export class MembershipTiersController {
  constructor(private readonly service: MembershipTierConfigService) {}

  @ApiOperation({ summary: 'List every membership tier and its benefits' })
  @ApiOkResponse({ type: [MembershipTierDto] })
  @Get()
  @HttpCode(HttpStatus.OK)
  findAll(): MembershipTierDto[] {
    return this.service.list();
  }
}
