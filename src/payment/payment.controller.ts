import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Request,
  HttpCode,
  HttpStatus,
  UseGuards,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { SubmitOrderDto } from '../orders/dto/submit-order.dto';
import { clientIp } from '../tickets/ticket-spam-guard';

@ApiTags('Payment')
@Controller({ path: 'payment', version: '1' })
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('plan/checkout')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        paymentUrl: { type: 'string' },
        orderNumber: { type: 'string' },
      },
    },
  })
  checkout(
    @Request() req: { user: { id: number } } & Parameters<typeof clientIp>[0],
    @Body() dto: SubmitOrderDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<{ paymentUrl: string; orderNumber: string }> {
    // The buyer's address from nginx's X-Real-IP, not `@Ip()`: behind the
    // proxy that is always 127.0.0.1, which left "Vị trí & IP" empty and put
    // every order on one network for the fraud flags (doitac-3010 #049).
    return this.paymentService.createCheckout(
      req.user.id,
      dto,
      clientIp(req),
      userAgent,
    );
  }

  /**
   * Bank-transfer checkout (SePay). Returns the VietQR image URL
   * plus the reference code the buyer must put in the transfer memo. The order
   * stays `pending` until SePay's webhook confirms the money arrived.
   */
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('plan/bank-transfer')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        orderNumber: { type: 'string' },
        bankTransferCode: { type: 'string', example: 'ESIM7K2M9P' },
        qrUrl: { type: 'string' },
        amount: { type: 'number', example: 280000 },
        accountNumber: { type: 'string' },
        accountName: { type: 'string' },
        bankCode: { type: 'string', example: 'TCB' },
        paymentUrl: {
          type: 'string',
          description: 'Only set when the eXU wallet already covered the order',
        },
      },
    },
  })
  bankTransfer(
    @Request() req: { user: { id: number } } & Parameters<typeof clientIp>[0],
    @Body() dto: SubmitOrderDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    // The buyer's real address, as for the card checkout (doitac-3010 #049).
    return this.paymentService.createBankTransferCheckout(
      req.user.id,
      dto,
      clientIp(req),
      userAgent,
    );
  }

  /**
   * SePay webhook — fired when money lands in the receiving bank account.
   * Authenticated by the `Authorization: Apikey <token>` header.
   */
  @Post('sepay/webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: { success: { type: 'boolean' } },
    },
  })
  async sepayWebhook(
    @Headers('authorization') authorization: string,
    @Body() payload: Record<string, any>,
  ): Promise<{ success: boolean }> {
    if (!this.paymentService.verifySepayApiKey(authorization)) {
      throw new UnauthorizedException('Invalid SePay webhook API key');
    }
    return this.paymentService.handleSepayWebhook(payload);
  }

  @Get('plan/return')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        orderNumber: { type: 'string' },
        responseCode: { type: 'string' },
        success: { type: 'boolean' },
      },
    },
  })
  returnUrl(@Query() query: Record<string, string>) {
    return {
      orderNumber: query['vpc_MerchTxnRef'] ?? null,
      responseCode: query['vpc_TxnResponseCode'] ?? null,
      success: query['vpc_TxnResponseCode'] === '0',
    };
  }

  @Post('plan/ipn')
  @HttpCode(HttpStatus.OK)
  async ipn(
    @Query() query: Record<string, string>,
    @Body() body: Record<string, string>,
  ): Promise<{ code: string }> {
    const params = { ...body, ...query };
    return this.paymentService.handleIpn(params);
  }
}
