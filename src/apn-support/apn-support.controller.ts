import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import { ApnSupportService } from './apn-support.service';
import { FindAllApnSupportDto } from './dto/find-all-apn-support.dto';
import {
  CreateApnSupportDto,
  UpdateApnSupportDto,
} from './dto/save-apn-support.dto';
import { ApnSupport } from './domain/apn-support';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { infinityPagination } from '../utils/infinity-pagination';

@ApiTags('ApnSupport')
@Controller({
  path: 'apn-support',
  version: '1',
})
export class ApnSupportController {
  constructor(private readonly apnSupportService: ApnSupportService) {}

  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Get()
  @ApiOkResponse({ type: InfinityPaginationResponse(ApnSupport) })
  async findAll(
    @Query() query: FindAllApnSupportDto,
  ): Promise<InfinityPaginationResponseDto<ApnSupport>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    const list = (value?: string) =>
      (value ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

    const [data, count] = await this.apnSupportService.findAllWithPagination({
      paginationOptions: { page, limit },
      // Select-box filters (#044, test round 4).
      filters: {
        apns: list(query?.apns),
        supports: list(query?.supports),
        needsReview: query?.needsReview,
      },
    });

    return infinityPagination(data, { page, limit }, count);
  }

  /** Every APN in the table, for the filter's select box (#044). */
  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Get('options')
  async options() {
    return { data: await this.apnSupportService.listApns() };
  }

  /** The table as .xlsx, in the layout the import reads (#044). */
  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Get('export')
  async exportExcel(@Res() res: Response) {
    const buffer = await this.apnSupportService.exportExcel();
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="apn-tiktok-gpt-${date}.xlsx"`,
    );
    res.send(buffer);
  }

  /** Add every APN supplier plans use that the table lacks (#044). */
  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post('sync-from-plans')
  @HttpCode(HttpStatus.OK)
  syncFromPlans() {
    return this.apnSupportService.syncFromPlans();
  }

  /** Add one APN by hand (#044). */
  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post()
  create(@Body() body: CreateApnSupportDto) {
    return this.apnSupportService.create(body);
  }

  /** Edit one APN (#044). */
  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateApnSupportDto) {
    return this.apnSupportService.update(id, body);
  }

  /** Delete one APN (#044). */
  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.apnSupportService.remove(id);
  }

  /**
   * Replace the whole APN table from an uploaded sheet (#065).
   *
   * Admin-only and a replace, not a merge: an upload is the authoritative list as
   * of that moment, and this table decides what the storefront advertises as
   * working with TikTok.
   */
  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post('import')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description:
      'APN sheet (.xlsx). Columns are found by header text: APN, TikTok iPhone, TikTok Android, ChatGPT, and an optional note.',
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOkResponse({
    description: 'How many APNs the table now holds',
    schema: {
      type: 'object',
      properties: {
        total: { type: 'number' },
        duplicates: { type: 'array', items: { type: 'string' } },
        errors: { type: 'array', items: { type: 'object' } },
      },
    },
  })
  async importExcel(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Chưa chọn file.');
    }
    return this.apnSupportService.importFromExcel(file.buffer);
  }
}
