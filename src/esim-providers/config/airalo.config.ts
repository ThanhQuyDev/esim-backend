import { registerAs } from '@nestjs/config';
import { AiraloConfig } from './airalo-config.type';
import validateConfig from '../../utils/validate-config';
import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

class EnvironmentVariablesValidator {
  @IsString()
  @IsNotEmpty()
  AIRALO_API_CLIENT_ID: string;

  @IsString()
  @IsNotEmpty()
  AIRALO_API_CLIENT_SECRET: string;

  @IsUrl({ require_tld: false })
  @IsOptional()
  AIRALO_BASE_URL: string;
}

export default registerAs<AiraloConfig>('airalo', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    clientId: process.env.AIRALO_API_CLIENT_ID!,
    clientSecret: process.env.AIRALO_API_CLIENT_SECRET!,
    baseUrl: process.env.AIRALO_BASE_URL || 'https://partners-api.airalo.com',
  };
});
