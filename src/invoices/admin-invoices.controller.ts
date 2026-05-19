import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceForOrderDto } from './dto/create-invoice-for-order.dto';
import { Invoice } from './domain/invoice';

/**
 * Admin endpoints under /admin/orders/:orderId/invoices.
 * Lives in the Invoices module so it can depend on InvoicesService directly
 * without forming a circular import with OrdersModule.
 */
@ApiBearerAuth()
@ApiTags('Admin Invoices')
@Roles(RoleEnum.admin)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({
  path: 'admin/orders',
  version: '1',
})
export class AdminInvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  /**
   * Feature 1.2 — Persist a financial-invoice request for an existing order.
   * Returns the freshly created Invoice in PENDING state.
   */
  @Post(':orderId/invoices')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a financial-invoice request linked 1:1 to an order',
  })
  @ApiParam({ name: 'orderId', type: Number, required: true })
  @ApiCreatedResponse({ type: Invoice })
  createInvoiceForOrder(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() dto: CreateInvoiceForOrderDto,
  ): Promise<Invoice> {
    return this.invoicesService.createForOrder(orderId, dto);
  }
}
