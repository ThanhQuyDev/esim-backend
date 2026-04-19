import { registerAs } from '@nestjs/config';
import { GadgetKoreaConfig } from './gadgetkorea-config.type';
import validateConfig from '../../utils/validate-config';
import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

class EnvironmentVariablesValidator {
  @IsString()
  @IsNotEmpty()
  GADGET_KOREA_ACCESS_KEY: string;

  @IsString()
  @IsNotEmpty()
  GADGET_KOREA_SECRET_KEY: string;

  @IsUrl({ require_tld: false })
  @IsOptional()
  GADGET_KOREA_BASE_URL: string;
}

export default registerAs<GadgetKoreaConfig>('gadgetKorea', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    accessKey: process.env.GADGET_KOREA_ACCESS_KEY!,
    secretKey: process.env.GADGET_KOREA_SECRET_KEY!,
    baseUrl:
      process.env.GADGET_KOREA_BASE_URL || 'https://open-api.usimsa.com',
  };
});
