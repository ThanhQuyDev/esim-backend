import { registerAs } from '@nestjs/config';

import {
  IsString,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsBoolean,
  IsEmail,
} from 'class-validator';
import validateConfig from '../../utils/validate-config';
import { MailConfig } from './mail-config.type';

class EnvironmentVariablesValidator {
  @IsInt()
  @Min(0)
  @Max(65535)
  @IsOptional()
  MAIL_PORT: number;

  @IsString()
  MAIL_HOST: string;

  @IsString()
  @IsOptional()
  MAIL_USER: string;

  @IsString()
  @IsOptional()
  MAIL_PASSWORD: string;

  @IsEmail()
  MAIL_DEFAULT_EMAIL: string;

  @IsString()
  MAIL_DEFAULT_NAME: string;

  @IsBoolean()
  MAIL_IGNORE_TLS: boolean;

  @IsBoolean()
  MAIL_SECURE: boolean;

  @IsBoolean()
  MAIL_REQUIRE_TLS: boolean;

  // Infrastructure 2.5 — optional OTP-specific SMTP settings. All fields are
  // optional so existing environments keep working; only `MAIL_OTP_HOST`
  // triggers routing OTP emails through the dedicated transport.
  @IsString()
  @IsOptional()
  MAIL_OTP_HOST: string;

  @IsInt()
  @Min(0)
  @Max(65535)
  @IsOptional()
  MAIL_OTP_PORT: number;

  @IsString()
  @IsOptional()
  MAIL_OTP_USER: string;

  @IsString()
  @IsOptional()
  MAIL_OTP_PASSWORD: string;

  @IsEmail()
  @IsOptional()
  MAIL_OTP_DEFAULT_EMAIL: string;

  @IsString()
  @IsOptional()
  MAIL_OTP_DEFAULT_NAME: string;

  @IsBoolean()
  @IsOptional()
  MAIL_OTP_SECURE: boolean;

  @IsBoolean()
  @IsOptional()
  MAIL_OTP_IGNORE_TLS: boolean;

  @IsBoolean()
  @IsOptional()
  MAIL_OTP_REQUIRE_TLS: boolean;
}

export default registerAs<MailConfig>('mail', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    port: process.env.MAIL_PORT ? parseInt(process.env.MAIL_PORT, 10) : 587,
    host: process.env.MAIL_HOST,
    user: process.env.MAIL_USER,
    password: process.env.MAIL_PASSWORD,
    defaultEmail: process.env.MAIL_DEFAULT_EMAIL,
    defaultName: process.env.MAIL_DEFAULT_NAME,
    ignoreTLS: process.env.MAIL_IGNORE_TLS === 'true',
    secure: process.env.MAIL_SECURE === 'true',
    requireTLS: process.env.MAIL_REQUIRE_TLS === 'true',
    otp: {
      host: process.env.MAIL_OTP_HOST,
      port: process.env.MAIL_OTP_PORT
        ? parseInt(process.env.MAIL_OTP_PORT, 10)
        : 465,
      user: process.env.MAIL_OTP_USER,
      password: process.env.MAIL_OTP_PASSWORD,
      defaultEmail: process.env.MAIL_OTP_DEFAULT_EMAIL,
      defaultName: process.env.MAIL_OTP_DEFAULT_NAME,
      // OTP defaults are TLS-on / TLS-implicit on port 465 to match the
      // operational guidance in the change request.
      secure:
        process.env.MAIL_OTP_SECURE !== undefined
          ? process.env.MAIL_OTP_SECURE === 'true'
          : true,
      ignoreTLS: process.env.MAIL_OTP_IGNORE_TLS === 'true',
      requireTLS: process.env.MAIL_OTP_REQUIRE_TLS === 'true',
    },
  };
});
