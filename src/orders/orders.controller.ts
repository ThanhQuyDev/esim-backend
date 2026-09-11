import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  HttpStatus,
  HttpCode,
  Request,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { SubmitOrderDto } from './dto/submit-order.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { AuthGuard } from '@nestjs/passport';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { QueryOrderDto } from './dto/query-order.dto';
import { Order } from './domain/order';
import { OrdersService } from './orders.service';
import {
  OrdersExportService,
  exportFileTimestamp,
} from './orders-export.service';
import { RolesGuard } from '../roles/roles.guard';
import { infinityPagination } from '../utils/infinity-pagination';
import { UserOrderDetailDto } from './dto/user-order-detail.dto';
import { AdminOrderDetailDto } from './dto/admin-order-detail.dto';
import { RefundOrderDto } from '../wallets/dto/admin-wallet.dto';

@ApiBearerAuth()
@Roles(RoleEnum.admin)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiTags('Orders')
@Controller({
  path: 'orders',
  version: '1',
})
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly ordersExportService: OrdersExportService,
  ) {}

  @ApiCreatedResponse({ type: Order })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createOrderDto: CreateOrderDto): Promise<Order> {
    return this.ordersService.create(createOrderDto);
  }

  @Roles(RoleEnum.user, RoleEnum.admin)
  @ApiCreatedResponse({ type: Order })
  @Post('submit')
  @HttpCode(HttpStatus.CREATED)
  submitOrder(
    @Request() req: { user: { id: number } },
    @Body() dto: SubmitOrderDto,
  ): Promise<Order> {
    return this.ordersService.submitOrder(req.user.id, dto);
  }

  @Roles(RoleEnum.user, RoleEnum.admin)
  @ApiOkResponse({ type: UserOrderDetailDto })
  @Get('my/by-number/:orderNumber')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'orderNumber', type: String, required: true })
  findMyOrderByNumber(
    @Request() req: { user: { id: number } },
    @Param('orderNumber') orderNumber: string,
  ): Promise<UserOrderDetailDto | null> {
    return this.ordersService.findByOrderNumberAndUserId(
      orderNumber,
      req.user.id,
    );
  }

  @Roles(RoleEnum.user, RoleEnum.admin)
  @ApiOkResponse({ type: InfinityPaginationResponse(Order) })
  @Get('my/list')
  @HttpCode(HttpStatus.OK)
  async findMyOrders(
    @Request() req: { user: { id: number } },
    @Query() query: QueryOrderDto,
  ): Promise<InfinityPaginationResponseDto<Order>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 200) limit = 200;

    const [data, count] = await this.ordersService.findManyWithPagination({
      filterOptions: { ...query?.filters, userId: req.user.id },
      sortOptions: query?.sort,
      paginationOptions: { page, limit },
    });

    return infinityPagination(data, { page, limit }, count);
  }

  /**
   * Supplier-reconciliation export (#028): one row per order item, honouring
   * the same filters as the list, named after the moment it was exported.
   */
  @Get('export-excel')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Excel file download' })
  async exportExcel(
    @Query() query: QueryOrderDto,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.ordersExportService.exportToExcel(query?.filters);
    const filename = `don-hang-doi-soat-${exportFileTimestamp()}.xlsx`;

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }

  @ApiOkResponse({ type: InfinityPaginationResponse(Order) })
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query() query: QueryOrderDto,
  ): Promise<InfinityPaginationResponseDto<Order>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 200) {
      limit = 200;
    }

    // No default status: the admin's "Tất cả" filter sends none and must list
    // every order, pending and failed included. Defaulting to paid/refunded
    // hid unpaid orders from support and made this list disagree with the
    // reconciliation export above, which applies the same filters verbatim.
    const filters = { ...query?.filters };

    const [data, count] = await this.ordersService.findManyWithPagination({
      filterOptions: filters,
      sortOptions: query?.sort,
      paginationOptions: { page, limit },
    });

    return infinityPagination(data, { page, limit }, count);
  }

  @ApiOkResponse({ type: AdminOrderDetailDto })
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  findOne(@Param('id') id: Order['id']): Promise<AdminOrderDetailDto | null> {
    return this.ordersService.findDetailById(id);
  }

  /**
   * Re-send the unfulfilled lines of a paid order to the supplier (#030),
   * typically after topping the deposit back up. Lines that already have an
   * eSIM — or that the supplier already accepted — are skipped, so pressing it
   * twice cannot buy the same eSIM twice.
   */
  @Post(':id/retry-provisioning')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  retryProvisioning(@Param('id') id: Order['id']) {
    return this.ordersService.retryProvisioning(Number(id));
  }

  @Post(':id/refund')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  refundOrder(
    @Param('id') id: Order['id'],
    @Body() dto: RefundOrderDto,
    @Request() req: { user: { id: number } },
  ) {
    return this.ordersService.refundOrder(id, dto, req.user.id);
  }

  /**
   * Feature 3.1 — User-facing instant cancel for a PENDING order. Releases
   * the wallet hold, decrements the coupon usage counter and reverses any
   * pending referral so the buyer can re-use those resources straight away
   * instead of waiting for the 30-minute timeout cron.
   */
  @Roles(RoleEnum.user, RoleEnum.admin)
  @ApiOkResponse({ type: Order })
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  cancelOrder(
    @Param('id') id: Order['id'],
    @Request() req: { user: { id: number; role?: { id: number } } },
  ): Promise<Order> {
    // Admins can cancel any order; regular users only their own.
    const isAdmin = req.user?.role?.id === 1;
    return this.ordersService.cancelOrder(
      Number(id),
      isAdmin ? undefined : req.user.id,
    );
  }

  @ApiOkResponse({ type: Order })
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  update(
    @Param('id') id: Order['id'],
    @Body() updateOrderDto: UpdateOrderDto,
  ): Promise<Order | null> {
    return this.ordersService.update(id, updateOrderDto);
  }

  @Delete(':id')
  @ApiParam({ name: 'id', type: String, required: true })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: Order['id']): Promise<void> {
    return this.ordersService.remove(id);
  }
}
