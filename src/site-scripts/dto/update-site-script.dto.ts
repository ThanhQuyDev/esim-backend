import { PartialType } from '@nestjs/swagger';
import { CreateSiteScriptDto } from './create-site-script.dto';

export class UpdateSiteScriptDto extends PartialType(CreateSiteScriptDto) {}
