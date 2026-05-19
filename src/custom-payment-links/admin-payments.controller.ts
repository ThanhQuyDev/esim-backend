import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import { CustomPaymentLinksService } from './custom-payment-links.service';
import { CreateCustomPaymentLinkRequestDto } from './dto/create-custom-payment-link-request.dto';
import { CustomPaymentLink } from './domain/custom-payment-link';

@ApiBearerAuth()
@ApiTags('Admin Payments')
@Roles(RoleEnum.admin)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({
  path: 'admin/payments',
  version: '1',
})
export class AdminPaymentsController {
  constructor(
    private readonly customPaymentLinksService: CustomPaymentLinksService,
  ) {}

  /**
   * Feature 2.1 — Generate an arbitrary OnePay credit-card payment URL for
   * wholesale or off-catalogue purchases. Returns the link the admin can send
   * to the customer via Chat / Zalo / Email.
   */
  @Post('custom-link')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Create a custom OnePay payment URL for an arbitrary amount (wholesale / custom packages)',
  })
  @ApiCreatedResponse({ type: CustomPaymentLink })
  async createCustomLink(
    @Request() req: { user: { id: number } },
    @Body() dto: CreateCustomPaymentLinkRequestDto,
    @Ip() ip: string,
  ): Promise<CustomPaymentLink> {
    return this.customPaymentLinksService.createCustomLink({
      customerEmail: dto.customer_email,
      amount: dto.amount,
      currency: dto.currency ?? 'VND',
      description: dto.description,
      clientIp: ip,
      adminUserId: req.user.id,
    });
  }
}
