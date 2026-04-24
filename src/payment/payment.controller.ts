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
  Ip,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { SubmitOrderDto } from '../orders/dto/submit-order.dto';

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
    @Request() req: { user: { id: number } },
    @Body() dto: SubmitOrderDto,
    @Ip() ip: string,
  ): Promise<{ paymentUrl: string; orderNumber: string }> {
    return this.paymentService.createCheckout(req.user.id, dto, ip);
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
