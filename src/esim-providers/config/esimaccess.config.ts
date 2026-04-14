import { registerAs } from '@nestjs/config';
import { EsimAccessConfig } from './esimaccess-config.type';
import validateConfig from '../../utils/validate-config';
import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

class EnvironmentVariablesValidator {
  @IsString()
  @IsNotEmpty()
  ESIMS_ACCESS_CODE: string;

  @IsString()
  @IsNotEmpty()
  ESIM_ACCESS_SECRET_KEY: string;

  @IsUrl({ require_tld: false })
  @IsOptional()
  ESIM_ACCESS_BASE_URL: string;
}

export default registerAs<EsimAccessConfig>('esimAccess', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    accessCode: process.env.ESIMS_ACCESS_CODE!,
    secretKey: process.env.ESIM_ACCESS_SECRET_KEY!,
    baseUrl: process.env.ESIM_ACCESS_BASE_URL || 'https://api.esimaccess.com',
    webhookSecret: process.env.ESIM_ACCESS_WEBHOOK_SECRET,
  };
});
