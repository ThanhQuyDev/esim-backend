import {
  HttpStatus,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CreateManufacturerNoteDto } from './dto/create-manufacturer-note.dto';
import { UpdateManufacturerNoteDto } from './dto/update-manufacturer-note.dto';
import { ManufacturerNoteRepository } from './infrastructure/persistence/manufacturer-note.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { ManufacturerNote } from './domain/manufacturer-note';

/** Vietnamese is the storefront's default, so an unknown language reads as vi. */
const DEFAULT_LANGUAGE = 'vi';

@Injectable()
export class ManufacturerNotesService {
  constructor(private readonly noteRepository: ManufacturerNoteRepository) {}

  async create(createDto: CreateManufacturerNoteDto) {
    await this.assertNoOtherNote(createDto.manufacturer, createDto.language);
    return this.noteRepository.create({
      manufacturer: createDto.manufacturer.trim(),
      language: createDto.language,
      note: createDto.note,
      isActive: createDto.isActive ?? true,
    });
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.noteRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  /**
   * Brand name → note text for one language, which is what the supported-devices
   * grouping needs to hang a note on the right brand.
   *
   * Keyed case-insensitively: the brand is typed by hand in two places (the
   * device rows and the note), and "iphone" should not quietly fail to match
   * "iPhone".
   */
  async findActiveMap(language?: string): Promise<Map<string, string>> {
    const notes = await this.noteRepository.findActiveByLanguage(
      language || DEFAULT_LANGUAGE,
    );

    return new Map(
      notes.map((note) => [note.manufacturer.trim().toLowerCase(), note.note]),
    );
  }

  findById(id: ManufacturerNote['id']) {
    return this.noteRepository.findById(id);
  }

  async update(
    id: ManufacturerNote['id'],
    updateDto: UpdateManufacturerNoteDto,
  ) {
    if (
      updateDto.manufacturer !== undefined ||
      updateDto.language !== undefined
    ) {
      const current = await this.noteRepository.findById(id);
      if (current) {
        await this.assertNoOtherNote(
          updateDto.manufacturer ?? current.manufacturer,
          updateDto.language ?? current.language,
          id,
        );
      }
    }
    return this.noteRepository.update(id, {
      manufacturer: updateDto.manufacturer?.trim(),
      language: updateDto.language,
      note: updateDto.note,
      isActive: updateDto.isActive,
    });
  }

  /**
   * One note per brand and language (#052, test round 4). The database enforces
   * it, but its error surfaced as a bare "Internal server error" — the tester
   * could not tell that the brand already had a note to edit instead.
   */
  private async assertNoOtherNote(
    manufacturer: string,
    language: string,
    exceptId?: ManufacturerNote['id'],
  ): Promise<void> {
    const existing = await this.noteRepository.findByBrandAndLanguage(
      manufacturer.trim(),
      language,
    );
    if (existing && existing.id !== exceptId) {
      const languageName = language === 'en' ? 'tiếng Anh' : 'tiếng Việt';
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        message: `Hãng "${existing.manufacturer}" đã có ghi chú ${languageName} — hãy sửa ghi chú đó thay vì tạo mới.`,
        errors: { manufacturer: 'noteAlreadyExists' },
      });
    }
  }

  remove(id: ManufacturerNote['id']) {
    return this.noteRepository.remove(id);
  }
}
