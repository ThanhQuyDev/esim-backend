import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  HttpStatus,
  HttpCode,
  Request,
  NotFoundException,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import * as QRCode from 'qrcode';
import { FileInterceptor } from '@nestjs/platform-express';
import { CreateEsimDto } from './dto/create-esim.dto';
import { UpdateEsimDto } from './dto/update-esim.dto';
import { ImportEsimsExcelDto } from './dto/import-esims-excel.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { AuthGuard } from '@nestjs/passport';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { NullableType } from '../utils/types/nullable.type';
import { QueryEsimDto } from './dto/query-esim.dto';
import { Esim } from './domain/esim';
import { EsimsService } from './esims.service';
import { EsimsImportService, EsimImportResult } from './esims-import.service';
import { RolesGuard } from '../roles/roles.guard';
import { infinityPagination } from '../utils/infinity-pagination';
import { DataUsageResult } from './esims.service';

@ApiTags('Esims')
@Controller({ path: 'esims', version: '1' })
export class EsimsPublicController {
  constructor(private readonly esimsService: EsimsService) {}

  @Get(':id/qrcode')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: Number, required: true })
  @ApiOkResponse({ description: 'QR code PNG image' })
  async getQrCode(
    @Param('id') id: number,
    @Res() res: Response,
  ): Promise<void> {
    const esim = await this.esimsService.findById(id);
    if (!esim || !esim.lpa) {
      throw new NotFoundException('eSIM or LPA not found');
    }

    const buffer = await QRCode.toBuffer(esim.lpa, {
      width: 400,
      margin: 2,
      errorCorrectionLevel: 'M',
    });

    res.set({
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    });
    res.send(buffer);
  }
}

@ApiBearerAuth()
@Roles(RoleEnum.admin)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiTags('Esims')
@Controller({ path: 'esims', version: '1' })
export class EsimsController {
  constructor(
    private readonly esimsService: EsimsService,
    private readonly esimsImportService: EsimsImportService,
  ) {}

  @Roles(RoleEnum.user, RoleEnum.admin)
  @ApiOkResponse({ type: InfinityPaginationResponse(Esim) })
  @Get('my/list')
  @HttpCode(HttpStatus.OK)
  async findMyEsims(
    @Request() req: { user: { id: number } },
    @Query() query: QueryEsimDto,
  ): Promise<InfinityPaginationResponseDto<Esim>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) limit = 50;

    const [data, count] = await this.esimsService.findManyWithPagination({
      filterOptions: { ...query?.filters, userId: req.user.id },
      sortOptions: query?.sort,
      paginationOptions: { page, limit },
    });

    return infinityPagination(data, { page, limit }, count);
  }

  @Roles(RoleEnum.user, RoleEnum.admin)
  @ApiOkResponse({ type: Esim })
  @Get('my/:id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: Number, required: true })
  async findMyEsimById(
    @Request() req: { user: { id: number } },
    @Param('id') id: number,
  ): Promise<Esim> {
    const esim = await this.esimsService.findById(id);
    if (!esim || esim.userId !== req.user.id) {
      throw new NotFoundException();
    }
    return esim;
  }

  @Roles(RoleEnum.user, RoleEnum.admin)
  @ApiOkResponse()
  @Get('my/:id/data-usage')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: Number, required: true })
  async getMyEsimDataUsage(
    @Request() req: { user: { id: number } },
    @Param('id') id: number,
  ): Promise<DataUsageResult> {
    const esim = await this.esimsService.findById(id);
    if (!esim || esim.userId !== req.user.id) {
      throw new NotFoundException();
    }
    return this.esimsService.getDataUsage(esim);
  }

  @ApiCreatedResponse({ type: Esim })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createEsimDto: CreateEsimDto): Promise<Esim> {
    return this.esimsService.create(createEsimDto);
  }

  @ApiOkResponse({ type: InfinityPaginationResponse(Esim) })
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query() query: QueryEsimDto,
  ): Promise<InfinityPaginationResponseDto<Esim>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) limit = 50;

    const filterOptions = {
      ...query?.filters,
      search: query?.search || query?.filters?.search,
    };

    const [data, count] = await this.esimsService.findManyWithPagination({
      filterOptions,
      sortOptions: query?.sort,
      paginationOptions: { page, limit },
    });

    return infinityPagination(data, { page, limit }, count);
  }

  @ApiOkResponse({ type: Esim })
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  findOne(@Param('id') id: Esim['id']): Promise<NullableType<Esim>> {
    return this.esimsService.findByIdWithRelations(id);
  }

  @ApiOkResponse({ type: Esim })
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  update(
    @Param('id') id: Esim['id'],
    @Body() updateEsimDto: UpdateEsimDto,
  ): Promise<Esim | null> {
    return this.esimsService.update(id, updateEsimDto);
  }

  @Delete(':id')
  @ApiParam({ name: 'id', type: String, required: true })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: Esim['id']): Promise<void> {
    return this.esimsService.remove(id);
  }

  @Post('import-excel')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Upload Excel file with eSIM data',
    schema: {
      type: 'object',
      required: ['file', 'provider', 'countryCode'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Excel file (.xlsx, .xls)',
        },
        provider: {
          type: 'string',
          example: 'esimvn',
          description: 'Provider name',
        },
        countryCode: {
          type: 'string',
          example: 'VN',
          description: 'Country code for the plans',
        },
        type: {
          type: 'string',
          example: 'data-in-total',
          description:
            'Plan type: data-in-total, daily, unlimited, unlimited-reduce, fixed',
        },
        sheet: {
          type: 'string',
          description: 'Sheet name or 0-based index. Defaults to first sheet.',
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Import result summary',
    schema: {
      type: 'object',
      properties: {
        total: { type: 'number' },
        created: { type: 'number' },
        skipped: { type: 'number' },
        planCreated: { type: 'number' },
        errors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              row: { type: 'number' },
              iccid: { type: 'string' },
              error: { type: 'string' },
            },
          },
        },
      },
    },
  })
  async importExcel(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: ImportEsimsExcelDto,
  ): Promise<EsimImportResult> {
    if (!file) {
      throw new BadRequestException('Excel file is required');
    }

    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/octet-stream',
    ];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only .xlsx and .xls files are allowed.',
      );
    }

    return this.esimsImportService.importFromExcel(
      file.buffer,
      dto.provider,
      dto.countryCode,
      dto.type,
      dto.sheet,
    );
  }
}
