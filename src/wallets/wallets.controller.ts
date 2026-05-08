import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import {
  ManualWalletAdjustDto,
  UpdateWalletStatusDto,
} from './dto/admin-wallet.dto';
import {
  ReferralProfileDto,
  WalletMeDto,
  WalletTransactionDto,
} from './dto/wallet-response.dto';
import { WalletsService } from './wallets.service';

@ApiTags('Wallets')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'wallets', version: '1' })
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Roles(RoleEnum.user, RoleEnum.admin)
  @ApiOkResponse({ type: WalletMeDto })
  @Get('me')
  @HttpCode(HttpStatus.OK)
  getMyWallet(@Request() req: { user: { id: number } }): Promise<WalletMeDto> {
    return this.walletsService.getWalletSummary(req.user.id);
  }

  @Roles(RoleEnum.user, RoleEnum.admin)
  @ApiOkResponse({ type: [WalletTransactionDto] })
  @Get('me/transactions')
  @HttpCode(HttpStatus.OK)
  getMyTransactions(
    @Request() req: { user: { id: number } },
    @Query('limit') limit?: number,
  ): Promise<WalletTransactionDto[]> {
    return this.walletsService.getTransactions(req.user.id, Number(limit));
  }

  @Roles(RoleEnum.user, RoleEnum.admin)
  @ApiOkResponse({ type: ReferralProfileDto })
  @Get('me/referral')
  @HttpCode(HttpStatus.OK)
  getMyReferral(
    @Request() req: { user: { id: number } },
  ): Promise<ReferralProfileDto> {
    return this.walletsService.getReferralProfile(req.user.id);
  }

  @Roles(RoleEnum.admin)
  @ApiOkResponse({ type: [WalletMeDto] })
  @Get('admin')
  @HttpCode(HttpStatus.OK)
  listWallets() {
    return this.walletsService.listWallets();
  }

  @Roles(RoleEnum.admin)
  @ApiOkResponse({ type: WalletMeDto })
  @Get('admin/:userId')
  @HttpCode(HttpStatus.OK)
  getWalletForAdmin(@Param('userId') userId: number): Promise<WalletMeDto> {
    return this.walletsService.getWalletForAdmin(Number(userId));
  }

  @Roles(RoleEnum.admin)
  @Post('admin/:userId/adjust')
  @HttpCode(HttpStatus.OK)
  adjustWallet(
    @Param('userId') userId: number,
    @Body() dto: ManualWalletAdjustDto,
    @Request() req: { user: { id: number } },
  ) {
    return this.walletsService.adminAdjustWallet(
      Number(userId),
      dto.amountVnd,
      dto.reason ?? null,
      req.user.id,
    );
  }

  @Roles(RoleEnum.admin)
  @Post('admin/:userId/cancel')
  @HttpCode(HttpStatus.OK)
  cancelWallet(
    @Param('userId') userId: number,
    @Body() dto: Pick<ManualWalletAdjustDto, 'reason'>,
    @Request() req: { user: { id: number } },
  ) {
    return this.walletsService.cancelWalletBalance(
      Number(userId),
      dto.reason ?? null,
      req.user.id,
    );
  }

  @Roles(RoleEnum.admin)
  @Patch('admin/:userId/status')
  @HttpCode(HttpStatus.OK)
  updateWalletStatus(
    @Param('userId') userId: number,
    @Body() dto: UpdateWalletStatusDto,
  ) {
    return this.walletsService.updateWalletStatus(Number(userId), dto.status);
  }
}
