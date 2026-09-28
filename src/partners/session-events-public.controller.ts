import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
} from '@nestjs/common';
import { ApiOkResponse, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';
import { PartnersService } from './partners.service';
import { hashIpForFraudWatch } from '../orders/order-fraud-signals';

class SessionEventDto {
  @ApiPropertyOptional({
    type: String,
    example: 'plan_view',
    description:
      'One of plan_list, plan_view, add_to_cart, checkout_start. Anything else is dropped.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  type?: string;

  @ApiPropertyOptional({
    type: String,
    example: 'japan-7-days-5gb',
    description: 'The plan slug for a plan view; omitted for the other steps.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  ref?: string;
}

class RecordSessionEventsDto {
  @ApiPropertyOptional({ type: String, example: 'b6f0b1d0-7d5e-4f7a-9a3e' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  visitorId?: string;

  @ApiPropertyOptional({
    type: String,
    example: '9f1c7b2a4d6e8f0a1b3c5d7e9f0a1b2c',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  clickId?: string;

  @ApiPropertyOptional({ type: [SessionEventDto] })
  @IsOptional()
  @IsArray()
  events?: SessionEventDto[];
}

/**
 * Where the tracking snippet reports the steps of a buying session (#040).
 *
 * No auth: the visitor has not signed in yet, and most of the journey happens
 * before they do. Nothing here can change an order or a commission — the rows
 * it writes are only ever read as a pattern, and the service caps what one
 * visitor may file in a day.
 */
@ApiTags('Session Journey (Public)')
@Controller({ path: 'tracking', version: '1' })
export class SessionEventsPublicController {
  constructor(private readonly partnersService: PartnersService) {}

  @Post('events')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: { recorded: { type: 'number', example: 2 } },
    },
  })
  recordEvents(
    @Body() dto: RecordSessionEventsDto,
    @Ip() ip: string,
  ): Promise<{ recorded: number }> {
    return this.partnersService.recordSessionEvents({
      visitorId: dto.visitorId ?? null,
      clickId: dto.clickId ?? null,
      // Hashed on the way in, same as the click log: enough to compare, never
      // the address itself.
      ipHash: hashIpForFraudWatch(ip),
      events: (dto.events ?? []).map((event) => ({
        type: event.type ?? null,
        ref: event.ref ?? null,
      })),
    });
  }
}
