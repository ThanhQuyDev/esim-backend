import { registerAs } from '@nestjs/config';
import { BillionConfig } from './billion-config.type';
import validateConfig from '../../utils/validate-config';
import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

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
  };
});
