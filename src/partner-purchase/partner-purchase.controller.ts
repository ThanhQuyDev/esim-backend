import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PartnersService } from '../partners/partners.service';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import { CreatePartnerPurchaseDto } from './dto/create-partner-purchase.dto';
import { CreatePartnerCartPurchaseDto } from './dto/create-partner-cart-purchase.dto';
import { PartnerEsimTopupDto } from './dto/partner-esim-topup.dto';
import { PartnerPurchaseService } from './partner-purchase.service';

/**
 * Hai hành động ghi của luồng đối tác tự mua hàng (#046).
 *
 * Phần đọc — bảng giá, báo giá, danh sách đơn, file Excel giao hàng — nằm ở
 * `PartnersController` vì chỉ cần `PartnersService`. Hai route ở đây tách
 * riêng vì chúng cần `OrdersService`, mà `OrdersModule` đã import
 * `PartnersModule` nên không gọi ngược được.
 */
@ApiTags('Partners')
@Controller({ path: 'partners', version: '1' })
export class PartnerPurchaseController {
  constructor(
    private readonly partnersService: PartnersService,
    private readonly purchaseService: PartnerPurchaseService,
  ) {}

  /** Đặt mua và trừ ví ngay. */
  @ApiBearerAuth()
  @Roles(RoleEnum.partner, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post('me/purchases')
  @HttpCode(HttpStatus.CREATED)
  async purchase(
    @Request() req: { user: { id: number } },
    @Body() dto: CreatePartnerPurchaseDto,
  ) {
    const partner = await this.partnersService.getPartnerByUserId(req.user.id);
    return this.purchaseService.purchase(partner.id, {
      planId: dto.planId,
      quantity: dto.quantity,
      recipientEmail: dto.recipientEmail ?? null,
    });
  }

  /** Báo giá cả giỏ hàng trước khi thanh toán (doitac-1410 #035). */
  @ApiBearerAuth()
  @Roles(RoleEnum.partner, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post('me/purchases/cart/quote')
  @HttpCode(HttpStatus.OK)
  async quoteCart(
    @Request() req: { user: { id: number } },
    @Body() dto: CreatePartnerCartPurchaseDto,
  ) {
    const partner = await this.partnersService.getPartnerByUserId(req.user.id);
    return this.partnersService.quoteCart(partner.id, dto.items);
  }

  /** Thanh toán cả giỏ hàng trong một đơn (doitac-1410 #035). */
  @ApiBearerAuth()
  @Roles(RoleEnum.partner, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post('me/purchases/cart')
  @HttpCode(HttpStatus.CREATED)
  async purchaseCart(
    @Request() req: { user: { id: number } },
    @Body() dto: CreatePartnerCartPurchaseDto,
  ) {
    const partner = await this.partnersService.getPartnerByUserId(req.user.id);
    return this.purchaseService.purchaseCart(partner.id, {
      items: dto.items,
      recipientEmail: dto.recipientEmail ?? null,
    });
  }

  /** "Gửi lại email eSIM" for a whole order (doitac-1410 #042). */
  @ApiBearerAuth()
  @Roles(RoleEnum.partner, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post('me/purchases/:orderNumber/resend-email')
  @HttpCode(HttpStatus.OK)
  async resendPurchaseEmail(
    @Request() req: { user: { id: number } },
    @Param('orderNumber') orderNumber: string,
  ) {
    const partner = await this.partnersService.getPartnerByUserId(req.user.id);
    return this.purchaseService.resendPurchaseEmail(partner.id, orderNumber);
  }

  /** "Gửi lại email eSIM" from one eSIM's page (doitac-1410 #039). */
  @ApiBearerAuth()
  @Roles(RoleEnum.partner, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post('me/esims/:iccid/resend-email')
  @HttpCode(HttpStatus.OK)
  async resendEsimEmail(
    @Request() req: { user: { id: number } },
    @Param('iccid') iccid: string,
  ) {
    const partner = await this.partnersService.getPartnerByUserId(req.user.id);
    return this.purchaseService.resendEsimEmail(partner.id, iccid);
  }

  /** Topup packages for one eSIM, at the agent price (doitac-1410 #039). */
  @ApiBearerAuth()
  @Roles(RoleEnum.partner, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Get('me/esims/:iccid/topup-packages')
  @HttpCode(HttpStatus.OK)
  async listTopupPackages(
    @Request() req: { user: { id: number } },
    @Param('iccid') iccid: string,
  ) {
    const partner = await this.partnersService.getPartnerByUserId(req.user.id);
    return this.purchaseService.listTopupPackages(partner.id, iccid);
  }

  /** "Topup hộ khách", paid from the deposit wallet (doitac-1410 #039). */
  @ApiBearerAuth()
  @Roles(RoleEnum.partner, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post('me/esims/:iccid/topup')
  @HttpCode(HttpStatus.CREATED)
  async topupEsim(
    @Request() req: { user: { id: number } },
    @Param('iccid') iccid: string,
    @Body() dto: PartnerEsimTopupDto,
  ) {
    const partner = await this.partnersService.getPartnerByUserId(req.user.id);
    return this.purchaseService.topupEsim(partner.id, iccid, dto.packageId);
  }

  /** Đối tác tự huỷ đơn chưa cấp eSIM và nhận lại tiền vào ví. */
  @ApiBearerAuth()
  @Roles(RoleEnum.partner, RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post('me/purchases/:orderNumber/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @Request() req: { user: { id: number } },
    @Param('orderNumber') orderNumber: string,
  ) {
    const partner = await this.partnersService.getPartnerByUserId(req.user.id);
    return this.purchaseService.cancelPurchase(partner.id, orderNumber);
  }
}
