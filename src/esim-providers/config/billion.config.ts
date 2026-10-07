import { registerAs } from '@nestjs/config';
import { BillionConfig } from './billion-config.type';
import validateConfig from '../../utils/validate-config';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';

class EnvironmentVariablesValidator {
  @IsString()
  @IsNotEmpty()
  BILLION_CHANNEL_ID: string;

  @IsString()
  @IsNotEmpty()
  BILLION_APP_SECRET: string;

  @IsUrl({ require_tld: false })
  @IsOptional()
  BILLION_BASE_URL: string;

  @IsEmail()
  @IsOptional()
  BILLION_ORDER_EMAIL: string;
}

export default registerAs<BillionConfig>('billion', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    channelId: process.env.BILLION_CHANNEL_ID!,
    appSecret: process.env.BILLION_APP_SECRET!,
    // Full single-endpoint invoke URL. Test env by default; production is
    // https://apiint-flow.billionconnect.com/Flow/saler/2.0/invoke
    baseUrl:
      process.env.BILLION_BASE_URL ||
      'https://api-flow-ts.billionconnect.com/Flow/saler/2.0/invoke',
    // BILLION emails the eSIM to the address on the order (F040). That must be
    // our mailbox: sending the customer's exposed which supplier we use, and
    // they got a second, unbranded eSIM email next to ours (v3 #002).
    orderEmail: process.env.BILLION_ORDER_EMAIL || 'esimvietnam.api@gmail.com',
  };
});
