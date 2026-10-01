import {
  Body,
  Controller,
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
    });
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
