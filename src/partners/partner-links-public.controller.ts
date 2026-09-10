import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PartnersService } from './partners.service';

class RecordClickDto {
  ipHash?: string;
  userAgent?: string;
  referrer?: string;
  visitorId?: string;
}

@ApiTags('Partner Links (Public)')
@Controller({ path: 'partner-links', version: '1' })
export class PartnerLinksPublicController {
  constructor(private readonly partnersService: PartnersService) {}

  /**
   * Called by the public site's `/go/[code]` redirect route (no auth — the
   * visitor hasn't logged in yet). Returns null when the code doesn't match
   * an active link so the caller can fall back to the homepage.
   */
  @Post(':code/click')
  @HttpCode(HttpStatus.OK)
  recordClick(@Param('code') code: string, @Body() dto: RecordClickDto) {
    return this.partnersService.recordClick(code, dto);
  }
}
