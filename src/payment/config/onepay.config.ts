import { registerAs } from '@nestjs/config';
import { OnepayConfig } from './onepay-config.type';
import validateConfig from '../../utils/validate-config';
import { IsNotEmpty, IsString, IsUrl } from 'class-validator';

class EnvironmentVariablesValidator {
  @IsString()
  @IsNotEmpty()
  ONEPAY_MERCHANT_ID: string;

  @IsString()
  @IsNotEmpty()
  ONEPAY_ACCESS_CODE: string;

  @IsString()
  @IsNotEmpty()
  ONEPAY_HASH_SECRET: string;

  @IsUrl({ require_tld: false })
  @IsNotEmpty()
  ONEPAY_PAY_URL: string;

  @IsUrl({ require_tld: false })
  @IsNotEmpty()
  ONEPAY_RETURN_URL: string;

  @IsUrl({ require_tld: false })
  @IsNotEmpty()
  ONEPAY_IPN_URL: string;
}

export default registerAs<OnepayConfig>('onepay', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    merchantId: process.env.ONEPAY_MERCHANT_ID!,
    accessCode: process.env.ONEPAY_ACCESS_CODE!,
    hashSecret: process.env.ONEPAY_HASH_SECRET!,
    payUrl: process.env.ONEPAY_PAY_URL!,
    returnUrl: process.env.ONEPAY_RETURN_URL!,
    ipnUrl: process.env.ONEPAY_IPN_URL!,
  };
});
