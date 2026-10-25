import { Injectable } from '@nestjs/common';
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
    return this.noteRepository.create({
      manufacturer: createDto.manufacturer.trim(),
      language: createDto.language,
      note: createDto.note,
      isActive: createDto.isActive ?? true,
      sortOrder: createDto.sortOrder ?? 0,
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
   * Brand name → its notes for one language, in page order (vande #042), which
   * is what the supported-devices grouping hangs under each brand.
   *
   * Keyed case-insensitively: the brand is typed by hand in two places (the
   * device rows and the note), and "iphone" should not quietly fail to match
   * "iPhone". A brand with notes in the other language only shows those, so a
   * note written once is not missing from half the site.
   */
  async findActiveMap(language?: string): Promise<Map<string, string[]>> {
    const lang = language || DEFAULT_LANGUAGE;
    const notes = await this.noteRepository.findActive();
    const own = new Map<string, string[]>();
    const other = new Map<string, string[]>();
    for (const note of notes) {
      const key = note.manufacturer.trim().toLowerCase();
      const target = note.language === lang ? own : other;
      target.set(key, [...(target.get(key) ?? []), note.note]);
    }
    for (const [key, list] of other) {
      if (!own.has(key)) own.set(key, list);
    }
    return own;
  }

  findById(id: ManufacturerNote['id']) {
    return this.noteRepository.findById(id);
  }

  async update(
    id: ManufacturerNote['id'],
    updateDto: UpdateManufacturerNoteDto,
  ) {
    return this.noteRepository.update(id, {
      manufacturer: updateDto.manufacturer?.trim(),
      language: updateDto.language,
      note: updateDto.note,
      isActive: updateDto.isActive,
      sortOrder: updateDto.sortOrder,
    });
  }

  remove(id: ManufacturerNote['id']) {
    return this.noteRepository.remove(id);
  }
}
