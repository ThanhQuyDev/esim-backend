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
} from '@nestjs/common';
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
  constructor(private readonly ordersService: OrdersService) {}

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
    if (limit > 50) limit = 50;

    const [data, count] = await this.ordersService.findManyWithPagination({
      filterOptions: { ...query?.filters, userId: req.user.id },
      sortOptions: query?.sort,
      paginationOptions: { page, limit },
    });

    return infinityPagination(data, { page, limit }, count);
  }

  @ApiOkResponse({ type: InfinityPaginationResponse(Order) })
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query() query: QueryOrderDto,
  ): Promise<InfinityPaginationResponseDto<Order>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    const filters = { ...query?.filters };
    if (!filters.status) {
      filters.status = ['paid', 'refunded'];
    }

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
