import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AuthPageSettingDto,
  UpdateAuthPageSettingDto,
} from './dto/auth-page-setting.dto';
import { AuthPageSettingEntity } from './infrastructure/persistence/relational/entities/auth-page-setting.entity';

export const AUTH_PAGE_MODES = ['admin', 'partner'] as const;
export type AuthPageMode = (typeof AUTH_PAGE_MODES)[number];

/**
 * Sign-in page branding, editable from the CMS (#006).
 *
 * A row is created on first save, so a deployment with an empty table still
 * serves the sign-in page — it just falls back to the built-in copy.
 */
@Injectable()
export class AuthPagesService {
  constructor(
    @InjectRepository(AuthPageSettingEntity)
    private readonly repository: Repository<AuthPageSettingEntity>,
  ) {}

  private assertMode(mode: string): AuthPageMode {
    const value = (mode ?? '').trim().toLowerCase();
    if (!(AUTH_PAGE_MODES as readonly string[]).includes(value)) {
      throw new BadRequestException(
        `Invalid mode "${mode}", expected one of: ${AUTH_PAGE_MODES.join(', ')}`,
      );
    }
    return value as AuthPageMode;
  }

  async findAll(): Promise<AuthPageSettingDto[]> {
    const rows = await this.repository.find();
    const byMode = new Map(rows.map((row) => [row.mode, row]));
    return AUTH_PAGE_MODES.map((mode) => this.toDto(mode, byMode.get(mode)));
  }

  async findOne(mode: string): Promise<AuthPageSettingDto> {
    const value = this.assertMode(mode);
    const row = await this.repository.findOne({ where: { mode: value } });
    return this.toDto(value, row ?? undefined);
  }

  async update(
    mode: string,
    dto: UpdateAuthPageSettingDto,
  ): Promise<AuthPageSettingDto> {
    const value = this.assertMode(mode);
    const existing = await this.repository.findOne({ where: { mode: value } });

    // Only fields present in the body are touched, so a partial save from one
    // CMS tab cannot blank out what another field holds.
    const merged = this.repository.create({
      ...(existing ?? { mode: value }),
      mode: value,
      ...(dto.logoUrl !== undefined
        ? { logoUrl: this.clean(dto.logoUrl, 500) }
        : {}),
      ...(dto.logoText !== undefined
        ? { logoText: this.clean(dto.logoText, 120) }
        : {}),
      ...(dto.coverImageUrl !== undefined
        ? { coverImageUrl: this.clean(dto.coverImageUrl, 500) }
        : {}),
      ...(dto.quote !== undefined ? { quote: this.clean(dto.quote, 500) } : {}),
      ...(dto.quoteAuthor !== undefined
        ? { quoteAuthor: this.clean(dto.quoteAuthor, 120) }
        : {}),
      ...(dto.heading !== undefined
        ? { heading: this.clean(dto.heading, 120) }
        : {}),
      ...(dto.subheading !== undefined
        ? { subheading: this.clean(dto.subheading, 300) }
        : {}),
      ...(dto.signUpUrl !== undefined
        ? { signUpUrl: this.clean(dto.signUpUrl, 500) }
        : {}),
    });

    await this.repository.save(merged);
    return this.findOne(value);
  }

  /** Trim, and treat an emptied field as "back to the built-in default". */
  private clean(
    value: string | null | undefined,
    maxLength: number,
  ): string | null {
    const trimmed = (value ?? '').trim();
    return trimmed ? trimmed.slice(0, maxLength) : null;
  }

  private toDto(mode: string, row?: AuthPageSettingEntity): AuthPageSettingDto {
    return {
      mode,
      logoUrl: row?.logoUrl ?? null,
      logoText: row?.logoText ?? null,
      coverImageUrl: row?.coverImageUrl ?? null,
      quote: row?.quote ?? null,
      quoteAuthor: row?.quoteAuthor ?? null,
      heading: row?.heading ?? null,
      subheading: row?.subheading ?? null,
      signUpUrl: row?.signUpUrl ?? null,
      updatedAt: row?.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    };
  }
}
