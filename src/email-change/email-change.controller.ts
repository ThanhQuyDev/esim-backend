import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  SerializeOptions,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { EmailChangeService } from './email-change.service';
import {
  ConfirmEmailChangeDto,
  RequestEmailChangeDto,
} from './dto/request-email-change.dto';
import { User } from '../users/domain/user';

/**
 * Self-service email change for a signed-in customer (#057).
 *
 * Two steps, because login is email + OTP: the code goes to the NEW address and
 * only a returned code moves the account, so a typo can never lock a customer
 * out of their own eSIMs. The account is addressed by the JWT's user id — the old
 * email is never used as the key.
 */
@ApiTags('Auth')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'auth/me/email', version: '1' })
export class EmailChangeController {
  constructor(private readonly service: EmailChangeService) {}

  @ApiOperation({
    summary: 'Show which new address is waiting to be confirmed, if any',
  })
  @Get('change')
  @HttpCode(HttpStatus.OK)
  async pending(
    @Request() request: { user: { id: User['id'] } },
  ): Promise<{ pendingEmail: string | null }> {
    return {
      pendingEmail: await this.service.pendingEmail(request.user.id),
    };
  }

  @ApiOperation({ summary: 'Mail a confirmation code to the new address' })
  @Post('change')
  @HttpCode(HttpStatus.NO_CONTENT)
  async request(
    @Request() request: { user: { id: User['id'] } },
    @Body() dto: RequestEmailChangeDto,
  ): Promise<void> {
    await this.service.requestChange(request.user.id, dto.email);
  }

  @SerializeOptions({ groups: ['me'] })
  @ApiOperation({ summary: 'Confirm the code and switch the account over' })
  @ApiOkResponse({ type: User })
  @Post('change/confirm')
  @HttpCode(HttpStatus.OK)
  async confirm(
    @Request() request: { user: { id: User['id'] } },
    @Body() dto: ConfirmEmailChangeDto,
  ): Promise<User> {
    return this.service.confirmChange(request.user.id, dto.email, dto.code);
  }
}
