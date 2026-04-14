import {
  Controller,
  Post,
  Body,
  Headers,
  RawBodyRequest,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { WebhooksService } from './webhooks.service';

@ApiTags('Webhooks')
@Controller({ path: 'webhooks', version: '1' })
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('airalo')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive order events from Airalo' })
  @ApiOkResponse({ description: 'Event processed' })
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: false,
      forbidNonWhitelisted: false,
    }),
  )
  async airalo(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-airalo-signature') signature: string,
    @Body() payload: Record<string, any>,
  ): Promise<{ received: boolean }> {
    this.logger.log(`[Airalo] raw payload: ${JSON.stringify(payload)}`);
    if (signature && req.rawBody) {
      this.webhooksService.verifyAiraloSignature(req.rawBody, signature);
    }

    await this.webhooksService.handleAiraloEvent(payload);
    return { received: true };
  }

  @Post('esimaccess')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive order events from EsimAccess' })
  @ApiOkResponse({ description: 'Event processed' })
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: false,
      forbidNonWhitelisted: false,
    }),
  )
  async esimAccess(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-esimaccess-signature') signature: string,
    @Body() payload: Record<string, any>,
  ): Promise<{ received: boolean }> {
    this.logger.log(`[EsimAccess] raw payload: ${JSON.stringify(payload)}`);
    if (signature && req.rawBody) {
      this.webhooksService.verifyEsimAccessSignature(req.rawBody, signature);
    }

    await this.webhooksService.handleEsimAccessEvent(payload);
    return { received: true };
  }

  @Post('gadgetkorea')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive order events from Gadget Korea' })
  @ApiOkResponse({ description: 'Event processed' })
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: false,
      forbidNonWhitelisted: false,
    }),
  )
  async gadgetKorea(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-gadgetkorea-signature') signature: string,
    @Body() payload: Record<string, any>,
  ): Promise<{ received: boolean }> {
    this.logger.log(`[GadgetKorea] raw payload: ${JSON.stringify(payload)}`);
    if (signature && req.rawBody) {
      this.webhooksService.verifyGadgetKoreaSignature(req.rawBody, signature);
    }

    await this.webhooksService.handleGadgetKoreaEvent(payload);
    return { received: true };
  }
}
