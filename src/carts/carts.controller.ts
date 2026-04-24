import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Request,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import { CartsService } from './carts.service';
import { Cart } from './domain/cart';
import { CreateCartItemDto } from './dto/create-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@ApiBearerAuth()
@Roles(RoleEnum.user, RoleEnum.admin)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiTags('Carts')
@Controller({ path: 'carts', version: '1' })
export class CartsController {
  constructor(private readonly cartsService: CartsService) {}

  @ApiOkResponse({ type: [Cart] })
  @Get()
  @HttpCode(HttpStatus.OK)
  getCart(@Request() req: { user: { id: number } }): Promise<Cart[]> {
    return this.cartsService.getCart(req.user.id);
  }

  @ApiCreatedResponse({ type: Cart })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  addItem(
    @Request() req: { user: { id: number } },
    @Body() dto: CreateCartItemDto,
  ): Promise<Cart> {
    return this.cartsService.addItem(req.user.id, dto);
  }

  @ApiOkResponse({ type: Cart })
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: Number })
  updateItem(
    @Request() req: { user: { id: number } },
    @Param('id') id: number,
    @Body() dto: UpdateCartItemDto,
  ): Promise<Cart> {
    return this.cartsService.updateItem(req.user.id, Number(id), dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', type: Number })
  removeItem(
    @Request() req: { user: { id: number } },
    @Param('id') id: number,
  ): Promise<void> {
    return this.cartsService.removeItem(req.user.id, Number(id));
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  clearCart(@Request() req: { user: { id: number } }): Promise<void> {
    return this.cartsService.clearCart(req.user.id);
  }
}
