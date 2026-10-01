import { PartialType } from '@nestjs/swagger';
import { CreateManufacturerNoteDto } from './create-manufacturer-note.dto';

export class UpdateManufacturerNoteDto extends PartialType(
  CreateManufacturerNoteDto,
) {}
