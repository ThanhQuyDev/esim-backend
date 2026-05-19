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
import { TopupCheckoutDto } from './dto/topup-checkout.dto';
import { TopupPackageDto, TopupProvider } from './dto/topup-package.dto';

class TopupListResponse {
  success!: boolean;
  iccid!: string;
  provider!: TopupProvider;
  packages!: TopupPackageDto[];
}

class TopupCheckoutResponse {
  success!: true;
  orderId!: string;
  paymentUrl!: string;
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
}
