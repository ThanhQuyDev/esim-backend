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
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import { TwoFactorDisableDto } from './dto/auth-two-factor.dto';
import { TwoFactorService } from './two-factor.service';

/** "Đăng nhập 2 lớp (OTP)" in the admin's and the partner's profile (#005). */
@ApiTags('Auth')
@ApiBearerAuth()
@Roles(RoleEnum.admin, RoleEnum.partner)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'auth/me/two-factor', version: '1' })
export class TwoFactorController {
  constructor(private readonly service: TwoFactorService) {}

  @Get()
  status(@Request() req: { user: { id: number } }) {
    return this.service.status(Number(req.user.id));
  }

  @Post('enable')
  @HttpCode(HttpStatus.OK)
  enable(@Request() req: { user: { id: number } }) {
    return this.service.enable(Number(req.user.id));
  }

  /** Mails the code that switches it off. */
  @Post('disable/code')
  @HttpCode(HttpStatus.OK)
  requestDisableCode(@Request() req: { user: { id: number } }) {
    return this.service.requestDisableCode(Number(req.user.id));
  }

  @Post('disable')
  @HttpCode(HttpStatus.OK)
  disable(
    @Request() req: { user: { id: number } },
    @Body() dto: TwoFactorDisableDto,
  ) {
    return this.service.disable(Number(req.user.id), dto.code);
  }
}
