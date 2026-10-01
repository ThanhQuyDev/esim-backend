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

  // #059 — the IMAP mailbox support replies arrive in. All optional: the poller
  // stays off until MAIL_INBOUND_HOST is set.
  @IsString()
  @IsOptional()
  MAIL_INBOUND_HOST: string;

  @IsInt()
  @Min(0)
  @Max(65535)
  @IsOptional()
  MAIL_INBOUND_PORT: number;

  @IsString()
  @IsOptional()
  MAIL_INBOUND_USER: string;

  @IsString()
  @IsOptional()
  MAIL_INBOUND_PASSWORD: string;

  @IsBoolean()
  @IsOptional()
  MAIL_INBOUND_SECURE: boolean;

  @IsString()
  @IsOptional()
  MAIL_INBOUND_MAILBOX: string;

  // #062 — SMTP for the support mailbox, so ticket mail is sent as support@.
  @IsString()
  @IsOptional()
  MAIL_SUPPORT_HOST: string;

  @IsInt()
  @Min(0)
  @Max(65535)
  @IsOptional()
  MAIL_SUPPORT_PORT: number;

  @IsString()
  @IsOptional()
  MAIL_SUPPORT_USER: string;

  @IsString()
  @IsOptional()
  MAIL_SUPPORT_PASSWORD: string;

  @IsBoolean()
  @IsOptional()
  MAIL_SUPPORT_SECURE: boolean;

  @IsString()
  @IsOptional()
  MAIL_SUPPORT_DEFAULT_NAME: string;
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
    inbound: {
      host: process.env.MAIL_INBOUND_HOST,
      // 993 is implicit-TLS IMAP, which is what practically every provider
      // offers; 143 + STARTTLS is the exception, hence the explicit flag.
      port: process.env.MAIL_INBOUND_PORT
        ? parseInt(process.env.MAIL_INBOUND_PORT, 10)
        : 993,
      user: process.env.MAIL_INBOUND_USER,
      password: process.env.MAIL_INBOUND_PASSWORD,
      secure:
        process.env.MAIL_INBOUND_SECURE !== undefined
          ? process.env.MAIL_INBOUND_SECURE === 'true'
          : true,
      mailbox: process.env.MAIL_INBOUND_MAILBOX || 'INBOX',
    },
    support: {
      host: process.env.MAIL_SUPPORT_HOST,
      // 465 is implicit TLS, which is what the esim.com.vn mail server offers
      // alongside 587 + STARTTLS.
      port: process.env.MAIL_SUPPORT_PORT
        ? parseInt(process.env.MAIL_SUPPORT_PORT, 10)
        : 465,
      user: process.env.MAIL_SUPPORT_USER,
      password: process.env.MAIL_SUPPORT_PASSWORD,
      secure:
        process.env.MAIL_SUPPORT_SECURE !== undefined
          ? process.env.MAIL_SUPPORT_SECURE === 'true'
          : true,
      defaultName: process.env.MAIL_SUPPORT_DEFAULT_NAME,
    },
  };
});
