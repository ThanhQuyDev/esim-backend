import './utils/force-utc';
import { PublicCatalogScrubInterceptor } from './utils/public-catalog-scrub';
import { PlansService } from './plans/plans.service';
import type { MarginTier } from './plans/multiday-price';
import 'dotenv/config';
import {
  ClassSerializerInterceptor,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { useContainer } from 'class-validator';
import { AppModule } from './app.module';
import validationOptions from './utils/validation-options';
import { AllConfigType } from './config/config.type';
import { ResolvePromisesInterceptor } from './utils/serializer.interceptor';
import { corsOrigin } from './utils/cors-origins';
import { PriceDisplayService } from './profit-margins/price-display.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Only esim sites, from a browser (security 15/11/2026; was `true`).
    cors: { origin: corsOrigin },
    rawBody: true,
  });
  useContainer(app.select(AppModule), { fallbackOnErrors: true });
  const configService = app.get(ConfigService<AllConfigType>);

  app.enableShutdownHooks();
  app.setGlobalPrefix(
    configService.getOrThrow('app.apiPrefix', { infer: true }),
    {
      exclude: ['/'],
    },
  );
  app.enableVersioning({
    type: VersioningType.URI,
  });
  app.useGlobalPipes(new ValidationPipe(validationOptions));
  // Margin tiers for day-pass prices, read at most once a minute.
  const plansService = app.get(PlansService, { strict: false });
  let tierCache: { at: number; tiers: MarginTier[] } | null = null;
  const marginTiers = async (): Promise<MarginTier[]> => {
    if (tierCache && Date.now() - tierCache.at < 60_000) return tierCache.tiers;
    const tiers = await plansService.marginTiers();
    tierCache = { at: Date.now(), tiers };
    return tiers;
  };
  // Struck-out price on plans without a discount (vande-2011 #012), read at
  // most once a minute.
  const priceDisplay = app.get(PriceDisplayService, { strict: false });
  let strikeCache: { at: number; percent: number } | null = null;
  const autoStrikePercent = async (): Promise<number> => {
    if (strikeCache && Date.now() - strikeCache.at < 60_000) {
      return strikeCache.percent;
    }
    const { autoStrikePercent: percent } = await priceDisplay.get();
    strikeCache = { at: Date.now(), percent };
    return percent;
  };
  app.useGlobalInterceptors(
    // First, so it sees every response last, once serialized: no cost,
    // supplier or sales figure leaves the API except to an admin
    // (vande-2011 #041).
    new PublicCatalogScrubInterceptor(
      configService.getOrThrow('auth.secret', { infer: true }),
      marginTiers,
      autoStrikePercent,
    ),
    // ResolvePromisesInterceptor is used to resolve promises in responses because class-transformer can't do it
    // https://github.com/typestack/class-transformer/issues/549
    new ResolvePromisesInterceptor(),
    new ClassSerializerInterceptor(app.get(Reflector)),
  );

  const options = new DocumentBuilder()
    .setTitle('API')
    .setDescription('API docs')
    .setVersion('1.0')
    .addBearerAuth()
    .addGlobalParameters({
      in: 'header',
      required: false,
      name: process.env.APP_HEADER_LANGUAGE || 'x-custom-lang',
      schema: {
        example: 'en',
      },
    })
    .build();

  // Not on a live server unless asked for (security 12/11/2026): /docs-json
  // handed attackers a map of every route, admin ones included.
  if (
    process.env.NODE_ENV !== 'production' ||
    process.env.SWAGGER_ENABLED === 'true'
  ) {
    const document = SwaggerModule.createDocument(app, options);
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(configService.getOrThrow('app.port', { infer: true }));
}
void bootstrap();
