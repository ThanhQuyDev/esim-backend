import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../roles/roles.decorator';
import { RoleEnum } from '../../roles/roles.enum';
import { RolesGuard } from '../../roles/roles.guard';
import { MembershipTierConfigService } from './membership-tier-config.service';
import { MembershipTierDto } from './membership-tier.dto';
import { MembershipTierEnum } from './tier.enum';
import { UpdateMembershipTierDto } from './update-membership-tier.dto';

/**
 * Customer membership tier management for the CMS (#024).
 *
 * The four tiers themselves are fixed; what each one requires and pays is
 * editable. A change applies to cashback on orders placed afterwards and to
 * referral rewards paid afterwards — cashback already snapshotted onto an order
 * is not touched.
 */
@ApiTags('Admin Membership Tiers')
@ApiBearerAuth()
@Roles(RoleEnum.admin)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'admin/membership-tiers', version: '1' })
export class AdminMembershipTiersController {
  constructor(private readonly service: MembershipTierConfigService) {}

  @ApiOperation({ summary: 'List every membership tier and its benefits' })
  @ApiOkResponse({ type: [MembershipTierDto] })
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(): Promise<MembershipTierDto[]> {
    await this.service.reload();
    return this.service.list();
  }

  @ApiOperation({
    summary: 'Change what one tier requires and pays; returns the whole ladder',
  })
  @ApiParam({ name: 'tier', enum: MembershipTierEnum })
  @ApiOkResponse({ type: [MembershipTierDto] })
  @Patch(':tier')
  @HttpCode(HttpStatus.OK)
  update(
    @Param('tier', new ParseEnumPipe(MembershipTierEnum))
    tier: MembershipTierEnum,
    @Body() dto: UpdateMembershipTierDto,
  ): Promise<MembershipTierDto[]> {
    return this.service.update(tier, dto);
  }
}
