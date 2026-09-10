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
  NotFoundException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { AuthGuard } from '@nestjs/passport';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../roles/roles.guard';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { infinityPagination } from '../utils/infinity-pagination';
import { CouponsService } from './coupons.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { QueryCouponDto } from './dto/query-coupon.dto';
import {
  ValidateCouponDto,
  ValidateCouponResponseDto,
} from './dto/validate-coupon.dto';
import { Coupon } from './domain/coupon';

@ApiTags('Coupons')
@Controller({ path: 'coupons', version: '1' })
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiCreatedResponse({ type: Coupon })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createCouponDto: CreateCouponDto): Promise<Coupon> {
    return this.couponsService.create(createCouponDto);
  }

  /**
   * Public listing — this is what the cart page reads, with no token.
   *
   * Anyone but an admin sees public codes only (#081): a private code is
   * meant for one campaign, one customer or one partner, and listing it
   * here hands it to every shopper. Admins keep the unfiltered view, so
   * the CMS listing still shows both kinds.
   */
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOkResponse({ type: InfinityPaginationResponse(Coupon) })
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Request() request: { user?: { role?: { id?: number | string } } },
    @Query() query: QueryCouponDto,
  ): Promise<InfinityPaginationResponseDto<Coupon>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) limit = 50;

    const isAdmin = String(request?.user?.role?.id) === String(RoleEnum.admin);
    const filterOptions = isAdmin
      ? query?.filters
      : { ...(query?.filters ?? {}), isPublic: true };

    const [data, count] = await this.couponsService.findManyWithPagination({
      filterOptions,
      sortOptions: query?.sort,
      paginationOptions: { page, limit },
    });

    return infinityPagination(data, { page, limit }, count);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOkResponse({ type: Coupon })
  @Get('code/:code')
  @HttpCode(HttpStatus.OK)
  async findByCode(@Param('code') code: string): Promise<Coupon> {
    const coupon = await this.couponsService.findByCode(code);
    if (!coupon) throw new NotFoundException('Coupon not found');
    return coupon;
  }

  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiOkResponse({ type: Coupon })
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  findOne(@Param('id') id: number): Promise<Coupon | null> {
    return this.couponsService.findById(id);
  }

  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiOkResponse({ type: Coupon })
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  update(
    @Param('id') id: number,
    @Body() updateCouponDto: UpdateCouponDto,
  ): Promise<Coupon | null> {
    return this.couponsService.update(id, updateCouponDto);
  }

  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: number): Promise<void> {
    return this.couponsService.remove(id);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOkResponse({ type: ValidateCouponResponseDto })
  @Post('validate')
  @HttpCode(HttpStatus.OK)
  validate(
    @Body() validateCouponDto: ValidateCouponDto,
    @Request() req: any,
  ): Promise<ValidateCouponResponseDto> {
    return this.couponsService.validateCoupon(validateCouponDto, req.user.id);
  }
}
