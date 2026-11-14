import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import { SalesPasswordService } from './sales-password.service';

export class SetSalesPasswordDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Mã xác nhận gồm 6 chữ số.' })
  code: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  newPassword: string;
}

export class ChangeSalesPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  currentPassword: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  newPassword: string;
}

/** "Mật khẩu bán hàng" in the admin's and the partner's profile (#004). */
@ApiTags('Sales password')
@ApiBearerAuth()
@Roles(RoleEnum.admin, RoleEnum.partner)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'auth/me/sales-password', version: '1' })
export class SalesPasswordController {
  constructor(private readonly service: SalesPasswordService) {}

  @Get()
  status(@Request() req: { user: { id: number } }) {
    return this.service.status(Number(req.user.id));
  }

  /** Mails a code that sets it the first time or resets a forgotten one. */
  @Post('code')
  @HttpCode(HttpStatus.OK)
  requestCode(@Request() req: { user: { id: number } }) {
    return this.service.requestCode(Number(req.user.id));
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  setWithCode(
    @Request() req: { user: { id: number } },
    @Body() dto: SetSalesPasswordDto,
  ) {
    return this.service.setWithCode(
      Number(req.user.id),
      dto.code,
      dto.newPassword,
    );
  }

  @Post('change')
  @HttpCode(HttpStatus.OK)
  change(
    @Request() req: { user: { id: number } },
    @Body() dto: ChangeSalesPasswordDto,
  ) {
    return this.service.change(
      Number(req.user.id),
      dto.currentPassword,
      dto.newPassword,
    );
  }
}
