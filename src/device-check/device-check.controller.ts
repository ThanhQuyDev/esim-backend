import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { DeviceCheckStore, type DeviceCheckState } from './device-check.store';

export class DeviceCheckResultDto {
  @IsIn(['ok', 'no', 'unk'])
  state!: DeviceCheckState;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  model?: string | null;
}

type IncomingRequest = {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
};

function clientIp(req: IncomingRequest): string {
  const real = req.headers['x-real-ip'];
  return (Array.isArray(real) ? real[0] : real) || req.ip || 'unknown';
}

/**
 * QR hand-off for the supported-devices page (vande-2011 #031): public, no
 * account, nothing personal stored. See {@link DeviceCheckStore}.
 */
@ApiTags('DeviceCheck')
@Controller({ path: 'device-check', version: '1' })
export class DeviceCheckController {
  private readonly store = new DeviceCheckStore();

  @Post('sessions')
  @HttpCode(HttpStatus.CREATED)
  create(@Req() req: IncomingRequest) {
    if (!this.store.createPerIp.hit(clientIp(req)).ok) {
      throw new HttpException(
        'Too many requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return this.store.create();
  }

  @Post('sessions/:token/result')
  @HttpCode(HttpStatus.NO_CONTENT)
  submit(
    @Param('token') token: string,
    @Body() body: DeviceCheckResultDto,
    @Req() req: IncomingRequest,
  ) {
    if (!this.store.resultPerIp.hit(clientIp(req)).ok) {
      throw new HttpException(
        'Too many requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const ok = this.store.submit(token, {
      state: body.state,
      name: body.name.trim(),
      model: body.model?.trim() || null,
    });
    // One answer for unknown, expired and used tokens: nothing to probe.
    if (!ok) throw new NotFoundException();
  }

  @Get('sessions/:token')
  read(@Param('token') token: string) {
    return this.store.read(token);
  }
}
