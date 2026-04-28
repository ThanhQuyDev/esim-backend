import { PartialType } from '@nestjs/swagger';
import { CreateMiniTagDto } from './create-mini-tag.dto';

export class UpdateMiniTagDto extends PartialType(CreateMiniTagDto) {}
