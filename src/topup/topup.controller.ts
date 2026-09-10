import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { TopupService } from './topup.service';
import { ListTopupPackagesQueryDto } from './dto/list-topup-packages-query.dto';
import {
  AdminManualTopupDto,
  TopupCheckoutDto,
} from './dto/topup-checkout.dto';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import { TopupPackageDto, TopupProvider } from './dto/topup-package.dto';

class TopupListResponse {
  success!: boolean;
  iccid!: string;
  provider!: TopupProvider;
  packages!: TopupPackageDto[];
}

class AdminManualTopupResponse {
  /** True only when the provider actually applied the topup. */
  success!: boolean;
  orderNumber!: string;
  /** Final order status — `completed` or `MANUAL_INTERVENTION`. */
  status!: string;
  vndAmount!: number;
}

class TopupCheckoutResponse {
  success!: true;
  orderId!: string;
  paymentUrl!: string;
}

class TopupBankTransferResponse {
  success!: true;
  orderId!: string;
  /** Reference code the buyer must include in the transfer memo. */
  bankTransferCode!: string;
  /** VietQR image URL with account, amount and memo pre-filled. */
  qrUrl!: string;
  amount!: number;
  accountNumber!: string;
  accountName!: string;
  bankCode!: string;
}

/**
 * Public Topup endpoints — see "Đặc tả Kỹ thuật Topup" spec.
 *
 * Both endpoints require auth so we can attribute the resulting Order to
 * a user; this matches the existing `/payment/plan/checkout` flow.
 */
@ApiTags('Topup')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'topup', version: '1' })
export class TopupController {
  constructor(private readonly topupService: TopupService) {}

  @Get('packages')
  @ApiOkResponse({ type: TopupListResponse })
  async listPackages(
    @Query() query: ListTopupPackagesQueryDto,
  ): Promise<TopupListResponse> {
    const result = await this.topupService.listPackages(query.iccid);
    return { success: true, ...result };
  }

  @Post('checkout')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: TopupCheckoutResponse })
  async checkout(
    @Request() req: { user: { id: number } },
    @Body() dto: TopupCheckoutDto,
    @Ip() ip: string,
  ): Promise<TopupCheckoutResponse> {
    return this.topupService.checkout(req.user.id, dto, ip);
  }

  /**
   * Bank-transfer topup checkout (SePay / Techcombank). Returns the VietQR
   * plus the reference code to put in the transfer memo; the order is
   * finalized asynchronously by the SePay webhook.
   */
  /**
   * Admin tops an eSIM up for a customer without a gateway payment (#026).
   * The order is attributed to the eSIM's owner and marked paid immediately,
   * then the provider call runs synchronously so the admin sees the outcome.
   */
  @Post('admin/manual')
  @Roles(RoleEnum.admin)
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AdminManualTopupResponse })
  async adminManual(
    @Request() req: { user: { id: number } },
    @Body() dto: AdminManualTopupDto,
  ): Promise<AdminManualTopupResponse> {
    return this.topupService.adminManualTopup(dto, req.user.id);
  }

  @Post('bank-transfer')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: TopupBankTransferResponse })
  async bankTransfer(
    @Request() req: { user: { id: number } },
    @Body() dto: TopupCheckoutDto,
  ): Promise<TopupBankTransferResponse> {
    return this.topupService.checkoutBankTransfer(req.user.id, dto);
  }
}
