import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { FilesModule } from './files/files.module';
import { AuthModule } from './auth/auth.module';
import databaseConfig from './database/config/database.config';
import authConfig from './auth/config/auth.config';
import appConfig from './config/app.config';
import mailConfig from './mail/config/mail.config';
import fileConfig from './files/config/file.config';
import googleConfig from './auth-google/config/google.config';
import esimAccessConfig from './esim-providers/config/esimaccess.config';
import airaloConfig from './esim-providers/config/airalo.config';
import gadgetKoreaConfig from './esim-providers/config/gadgetkorea.config';
import japanTravelSimConfig from './esim-providers/config/japantravelsim.config';
import onepayConfig from './payment/config/onepay.config';
import path from 'path';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthGoogleModule } from './auth-google/auth-google.module';
import { HeaderResolver, I18nModule } from 'nestjs-i18n';
import { TypeOrmConfigService } from './database/typeorm-config.service';
import { MailModule } from './mail/mail.module';
import { HomeModule } from './home/home.module';
import { DataSource, DataSourceOptions } from 'typeorm';
import { AllConfigType } from './config/config.type';
import { SessionModule } from './session/session.module';
import { MailerModule } from './mailer/mailer.module';
import { DestinationsModule } from './destinations/destinations.module';
import { RegionsModule } from './regions/regions.module';
import { PlansModule } from './plans/plans.module';
import { PlanPricesModule } from './plan-prices/plan-prices.module';
import { OrdersModule } from './orders/orders.module';
import { OrderItemsModule } from './order-items/order-items.module';
import { EsimsModule } from './esims/esims.module';
import { ProviderSyncLogsModule } from './provider-sync-logs/provider-sync-logs.module';
import { EsimProvidersModule } from './esim-providers/esim-providers.module';
import { ProfitMarginsModule } from './profit-margins/profit-margins.module';

const infrastructureDatabaseModule = TypeOrmModule.forRootAsync({
  useClass: TypeOrmConfigService,
  dataSourceFactory: async (options: DataSourceOptions) => {
    return new DataSource(options).initialize();
  },
});

import { FaqsModule } from './faqs/faqs.module';

import { WhyChooseUsModule } from './why-choose-us/why-choose-us.module';

import { BlogsModule } from './blogs/blogs.module';
import { HelpCenterModule } from './help-center/help-center.module';

import { WebhooksModule } from './webhooks/webhooks.module';
import { CouponsModule } from './coupons/coupons.module';
import { PaymentModule } from './payment/payment.module';
import { WalletsModule } from './wallets/wallets.module';
import { ScheduleModule } from '@nestjs/schedule';
import { CartsModule } from './carts/carts.module';
import { SupportedDevicesModule } from './supported-devices/supported-devices.module';
import { EmailTemplatesModule } from './email-templates/email-templates.module';
import { SeoConfigsModule } from './seo-configs/seo-configs.module';
import { MiniTagsModule } from './mini-tags/mini-tags.module';
import { ChatModule } from './chat/chat.module';

import { HeroBannersModule } from './hero-banners/hero-banners.module';

import { FootersModule } from './footers/footers.module';

import { TopBarsModule } from './top-bars/top-bars.module';
import { OverviewModule } from './overview/overview.module';

@Module({
  imports: [
    TopBarsModule,
    FootersModule,
    HeroBannersModule,
    ScheduleModule.forRoot(),
    BlogsModule,
    HelpCenterModule,
    WhyChooseUsModule,
    FaqsModule,
    WebhooksModule,
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        databaseConfig,
        authConfig,
        appConfig,
        mailConfig,
        fileConfig,
        googleConfig,
        esimAccessConfig,
        airaloConfig,
        gadgetKoreaConfig,
        japanTravelSimConfig,
        onepayConfig,
      ],
      envFilePath: ['.env'],
    }),
    infrastructureDatabaseModule,
    I18nModule.forRootAsync({
      useFactory: (configService: ConfigService<AllConfigType>) => ({
        fallbackLanguage: configService.getOrThrow('app.fallbackLanguage', {
          infer: true,
        }),
        loaderOptions: { path: path.join(__dirname, '/i18n/'), watch: true },
      }),
      resolvers: [
        {
          use: HeaderResolver,
          useFactory: (configService: ConfigService<AllConfigType>) => {
            return [
              configService.get('app.headerLanguage', {
                infer: true,
              }),
            ];
          },
          inject: [ConfigService],
        },
      ],
      imports: [ConfigModule],
      inject: [ConfigService],
    }),
    UsersModule,
    FilesModule,
    AuthModule,
    AuthGoogleModule,
    SessionModule,
    MailModule,
    MailerModule,
    HomeModule,
    DestinationsModule,
    RegionsModule,
    PlansModule,
    PlanPricesModule,
    OrdersModule,
    OrderItemsModule,
    EsimsModule,
    ProviderSyncLogsModule,
    EsimProvidersModule,
    ProfitMarginsModule,
    CouponsModule,
    PaymentModule,
    WalletsModule,
    CartsModule,
    SupportedDevicesModule,
    EmailTemplatesModule,
    SeoConfigsModule,
    MiniTagsModule,
    ChatModule,
    OverviewModule,
  ],
})
export class AppModule {}
