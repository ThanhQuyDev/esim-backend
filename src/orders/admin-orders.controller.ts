import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import { OrdersService } from './orders.service';
import { Order } from './domain/order';
import { SubmitManualOrderDto } from './dto/submit-manual-order.dto';

@ApiBearerAuth()
@ApiTags('Admin Orders')
@Roles(RoleEnum.admin)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({
  path: 'admin/orders',
  version: '1',
})
export class AdminOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * Feature 2.2 — Admin "đặt đơn hộ".
   * Creates the order, marks it PAID via internal admin approval, provisions the
   * eSIM via providers and DOES NOT trigger the auto delivery email. The admin
   * is expected to use the `resend-esim-email` endpoint after verifying that
   * the offline payment landed.
   */
  @Post('submit-manual')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Admin manual order (bypass OnePay/QR, set PAID immediately, mute auto email)',
  })
  @ApiCreatedResponse({ type: Order })
  submitManualOrder(
    @Request() req: { user: { id: number } },
    @Body() dto: SubmitManualOrderDto,
  ): Promise<Order> {
    return this.ordersService.submitManualOrder(req.user.id, dto);
  }

  /**
   * Feature 1.1 — Resend the eSIM activation email for an order.
   */
  @Post(':orderId/resend-esim-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Resend the eSIM purchase / activation email (and invoice email if attached) to the buyer of an order',
  })
  @ApiParam({ name: 'orderId', type: Number, required: true })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        sent: {
          type: 'number',
          example: 1,
          description: 'Number of eSIM purchase emails actually sent',
        },
        invoiceSent: {
          type: 'boolean',
          example: true,
          description:
            'True if an invoice confirmation email was also sent (only when the order has an invoice attached)',
        },
        skippedReason: {
          type: 'string',
          nullable: true,
          example: 'no-esims-provisioned-yet',
        },
      },
    },
  })
  resendEsimEmail(
    @Param('orderId', ParseIntPipe) orderId: number,
  ): Promise<{ sent: number; invoiceSent: boolean; skippedReason?: string }> {
    return this.ordersService.resendEsimEmail(orderId);
  }
}
