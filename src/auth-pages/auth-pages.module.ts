import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthPagesService } from './auth-pages.service';
import {
  AuthPageSettingsController,
  AuthPageSettingsPublicController,
} from './auth-pages.controller';
import { AuthPageSettingEntity } from './infrastructure/persistence/relational/entities/auth-page-setting.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AuthPageSettingEntity])],
  // Public first: its `GET :mode` must answer before the guarded controller's
  // routes are considered.
  controllers: [AuthPageSettingsPublicController, AuthPageSettingsController],
  providers: [AuthPagesService],
  exports: [AuthPagesService],
})
export class AuthPagesModule {}
