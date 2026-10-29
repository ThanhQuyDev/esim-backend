import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PartnersService } from './partners.service';

/**
 * Without validators the global pipe (`whitelist: true`) stripped every field,
 * so no click ever kept its IP hash or browser — and a device could not be
 * recognised, neither to count a double-load once nor to attribute an order to
 * it (vande #079).
 */
export class RecordClickDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  ipHash?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  userAgent?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  referrer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
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

  /**
   * Where a link points, WITHOUT counting a click (doitac-1410 #026): for a
   * HEAD request or a link-preview bot (Facebook, Threads, Zalo, Slack…), which
   * must still be sent to the right page but are not a visit.
   */
  @Get(':code/target')
  @HttpCode(HttpStatus.OK)
  linkTarget(@Param('code') code: string) {
    return this.partnersService.linkTarget(code);
  }
}
