import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Delete,
  Param,
  Patch,
  Post,
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
import {
  CreateMembershipTierDto,
  UpdateMembershipTierDto,
} from './update-membership-tier.dto';

/**
 * Customer membership tier management for the CMS (#024).
 *
 * What each tier requires and pays is editable, and so is its name; tiers
 * can be added and removed (vande #066). A change applies to cashback on orders placed afterwards and to
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
  @ApiParam({ name: 'tier', type: String })
  @ApiOkResponse({ type: [MembershipTierDto] })
  @Patch(':tier')
  @HttpCode(HttpStatus.OK)
  update(
    @Param('tier') tier: string,
    @Body() dto: UpdateMembershipTierDto,
  ): Promise<MembershipTierDto[]> {
    return this.service.update(tier, dto);
  }

  @ApiOperation({
    summary: 'Add a tier (vande #066); returns the whole ladder',
  })
  @ApiOkResponse({ type: [MembershipTierDto] })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateMembershipTierDto): Promise<MembershipTierDto[]> {
    return this.service.create(dto);
  }

  @ApiOperation({
    summary: 'Remove a tier nobody is placed on by hand (vande #066)',
  })
  @ApiParam({ name: 'tier', type: String })
  @ApiOkResponse({ type: [MembershipTierDto] })
  @Delete(':tier')
  @HttpCode(HttpStatus.OK)
  remove(@Param('tier') tier: string): Promise<MembershipTierDto[]> {
    return this.service.remove(tier);
  }
}
