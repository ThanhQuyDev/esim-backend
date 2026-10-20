import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Request,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiConsumes,
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
import {
  ORDER_IMPORT_MAX_BYTES,
  orderImportTemplate,
} from '../utils/order-import-file';
import { downloadFilename } from '../utils/download-filename';

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
  /** The order file template, "Mã gói cước" + "Số lượng" (doitac-1410 #084). */
  @Get('import-template')
  @ApiOperation({ summary: 'Template of the manual order file (.xlsx)' })
  async manualOrderTemplate(@Res() res: Response): Promise<void> {
    const buffer = await orderImportTemplate(false);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${downloadFilename('File-mau-dat-don-ho')}"`,
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }

  /**
   * Reads an order file and resolves each row to its plan, for the dialog to
   * fill in (doitac-1410 #084). Places nothing.
   */
  @Post('import-file')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: ORDER_IMPORT_MAX_BYTES } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Preview a manual order file (.xlsx / .csv)' })
  previewManualOrderFile(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Chưa chọn file.');
    return this.ordersService.previewManualOrderFile(
      file.buffer,
      file.originalname,
    );
  }

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
   *
   * Strictly eSIM-only. To re-send the invoice email, use the
   * "Issue invoice" action (PATCH /api/v1/invoices/:id { status: 'ISSUED' }).
   */
  @Post(':orderId/resend-esim-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend the eSIM purchase / activation email to the buyer',
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
  ): Promise<{ sent: number; skippedReason?: string }> {
    return this.ordersService.resendEsimEmail(orderId);
  }
}
