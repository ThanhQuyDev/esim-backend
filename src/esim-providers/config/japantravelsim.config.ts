import { registerAs } from '@nestjs/config';
import { JapanTravelSimConfig } from './japantravelsim-config.type';
import validateConfig from '../../utils/validate-config';
import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

class EnvironmentVariablesValidator {
  @IsString()
  @IsNotEmpty()
  JAPANTRAVELSIM_MB_ID: string;

  @IsString()
  @IsNotEmpty()
  JAPANTRAVELSIM_API_KEY: string;

  @IsString()
  @IsNotEmpty()
  JAPANTRAVELSIM_API_TOKEN: string;

  @IsUrl({ require_tld: false })
  @IsOptional()
  JAPANTRAVELSIM_BASE_URL: string;
}

export default registerAs<JapanTravelSimConfig>('japanTravelSim', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    mbId: process.env.JAPANTRAVELSIM_MB_ID!,
    apiKey: process.env.JAPANTRAVELSIM_API_KEY!,
    apiToken: process.env.JAPANTRAVELSIM_API_TOKEN!,
    baseUrl:
      process.env.JAPANTRAVELSIM_BASE_URL || 'https://japantravelsim.com',
  };
});
