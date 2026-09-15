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
import {
  EmailChangeService,
  type PendingEmailChange,
} from './email-change.service';
import {
  ConfirmEmailChangeDto,
  RequestEmailChangeDto,
  VerifyCurrentEmailChangeDto,
} from './dto/request-email-change.dto';
import { User } from '../users/domain/user';

/**
 * Self-service email change for a signed-in customer (#057, #023).
 *
 * A code goes to the CURRENT address first, then — once that checks out — a
 * second code goes to the NEW address, and only that second code moves the
 * account. The account is addressed by the JWT's user id; the old email is never
 * used as the key.
 */
@ApiTags('Auth')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'auth/me/email', version: '1' })
export class EmailChangeController {
  constructor(private readonly service: EmailChangeService) {}

  @ApiOperation({
    summary:
      'Show the new address waiting to be confirmed and which step it is on',
  })
  @Get('change')
  @HttpCode(HttpStatus.OK)
  async pending(
    @Request() request: { user: { id: User['id'] } },
  ): Promise<PendingEmailChange> {
    return this.service.pendingChange(request.user.id);
  }

  @ApiOperation({
    summary: 'Start a change: mail a code to the current address',
  })
  @Post('change')
  @HttpCode(HttpStatus.NO_CONTENT)
  async request(
    @Request() request: { user: { id: User['id'] } },
    @Body() dto: RequestEmailChangeDto,
  ): Promise<void> {
    await this.service.requestChange(request.user.id, dto.email);
  }

  @ApiOperation({
    summary:
      'Confirm the code from the current address, then mail one to the new address',
  })
  @Post('change/verify-current')
  @HttpCode(HttpStatus.OK)
  async verifyCurrent(
    @Request() request: { user: { id: User['id'] } },
    @Body() dto: VerifyCurrentEmailChangeDto,
  ): Promise<PendingEmailChange> {
    return this.service.verifyCurrentEmail(request.user.id, dto.code);
  }

  @SerializeOptions({ groups: ['me'] })
  @ApiOperation({
    summary:
      'Confirm the code from the new address and switch the account over',
  })
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
