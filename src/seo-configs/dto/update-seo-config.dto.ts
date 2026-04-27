import { PartialType } from '@nestjs/swagger';
import { CreateSeoConfigDto } from './create-seo-config.dto';

export class UpdateSeoConfigDto extends PartialType(CreateSeoConfigDto) {}
