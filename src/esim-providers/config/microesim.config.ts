import { registerAs } from '@nestjs/config';
import { MicroEsimConfig } from './microesim-config.type';
import validateConfig from '../../utils/validate-config';
import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

class EnvironmentVariablesValidator {
  @IsString()
  @IsNotEmpty()
  MICROESIM_ACCOUNT: string;

  @IsString()
  @IsNotEmpty()
  MICROESIM_SECRET: string;

  @IsString()
  @IsNotEmpty()
  MICROESIM_SALT: string;

  @IsUrl({ require_tld: false })
  @IsOptional()
  MICROESIM_BASE_URL: string;
}

export default registerAs<MicroEsimConfig>('microEsim', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    account: process.env.MICROESIM_ACCOUNT!,
    secret: process.env.MICROESIM_SECRET!,
    salt: process.env.MICROESIM_SALT!,
    baseUrl: process.env.MICROESIM_BASE_URL || 'https://business.microesim.com',
  };
});
