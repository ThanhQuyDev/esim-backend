import { PartialType } from '@nestjs/swagger';
import { CreateMenuSlideDto } from './create-menu-slide.dto';

export class UpdateMenuSlideDto extends PartialType(CreateMenuSlideDto) {}
