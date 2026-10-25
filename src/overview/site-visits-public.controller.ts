import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Request,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import { clientIp } from '../tickets/ticket-spam-guard';
import { OverviewInsightsService } from './overview-insights.service';

export class RecordSiteVisitDto {
  /** The browser's own id, from the `esim_visitor_id` cookie. */
  @IsString()
  @Matches(/^[A-Za-z0-9-]{8,64}$/)
  visitorId!: string;
}

/**
 * Where the storefront reports a visit, once per browser per day (vande
 * #059), for the audience charts on Tổng quan. No auth — most visitors never
 * sign in — and nothing here can touch an order: one row per browser per day
 * at most, whatever is sent.
 */
@ApiTags('Site visits (Public)')
@Controller({ path: 'tracking', version: '1' })
export class SiteVisitsPublicController {
  constructor(private readonly insights: OverviewInsightsService) {}

  @Post('visit')
  @HttpCode(HttpStatus.OK)
  recordVisit(
    @Body() dto: RecordSiteVisitDto,
    @Request() req: Parameters<typeof clientIp>[0],
    @Headers('user-agent') userAgent?: string,
    @Headers('x-forwarded-for') forwardedFor?: string,
  ): Promise<{ recorded: boolean }> {
    // The storefront relays the visitor's own address; the first hop is it.
    const forwarded = forwardedFor?.split(',')[0]?.trim();
    return this.insights.recordVisit({
      visitorId: dto.visitorId,
      userAgent: userAgent ?? null,
      ip: forwarded || clientIp(req),
    });
  }
}
