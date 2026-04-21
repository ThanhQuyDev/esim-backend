import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Query,
  HttpStatus,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import {
  ImportPlansExcelDto,
  PlanColumnMapping,
} from './dto/import-plans-excel.dto';
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
import { QueryPlanDto } from './dto/query-plan.dto';
import { Plan } from './domain/plan';
import { PlansService } from './plans.service';
import { PlansImportService, ImportResult } from './plans-import.service';
import { PlansEsimvnImportService } from './plans-esimvn-import.service';
import { PlansGadgetkoreaImportService } from './plans-gadgetkorea-import.service';
import { RolesGuard } from '../roles/roles.guard';
import { infinityPagination } from '../utils/infinity-pagination';

@ApiTags('Plans')
@Controller({ path: 'plans', version: '1' })
export class PlansController {
  constructor(
    private readonly plansService: PlansService,
    private readonly plansImportService: PlansImportService,
    private readonly plansEsimvnImportService: PlansEsimvnImportService,
    private readonly plansGadgetkoreaImportService: PlansGadgetkoreaImportService,
  ) {}

  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiCreatedResponse({ type: Plan })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createPlanDto: CreatePlanDto): Promise<Plan> {
    return this.plansService.create(createPlanDto);
  }

  @ApiOkResponse({ type: InfinityPaginationResponse(Plan) })
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query() query: QueryPlanDto,
  ): Promise<InfinityPaginationResponseDto<Plan>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) limit = 50;

    return infinityPagination(
      await this.plansService.findManyWithPagination({
        filterOptions: query?.filters,
        sortOptions: query?.sort,
        paginationOptions: { page, limit },
      }),
      { page, limit },
    );
  }

  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        dataPlans: {
          type: 'array',
          items: { $ref: '#/components/schemas/Plan' },
        },
        slowUnlimited: {
          type: 'array',
          items: { $ref: '#/components/schemas/Plan' },
        },
        fastUnlimited: {
          type: 'array',
          items: { $ref: '#/components/schemas/Plan' },
        },
        dailyUnlimited: {
          type: 'array',
          items: { $ref: '#/components/schemas/Plan' },
        },
      },
    },
  })
  @Get('by-destination/:slug')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'slug', type: String, required: true })
  findPlansByDestination(@Param('slug') slug: string) {
    return this.plansService.findPlansByDestination(slug);
  }

  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        dataPlans: {
          type: 'array',
          items: { $ref: '#/components/schemas/Plan' },
        },
        slowUnlimited: {
          type: 'array',
          items: { $ref: '#/components/schemas/Plan' },
        },
        fastUnlimited: {
          type: 'array',
          items: { $ref: '#/components/schemas/Plan' },
        },
        dailyUnlimited: {
          type: 'array',
          items: { $ref: '#/components/schemas/Plan' },
        },
      },
    },
  })
  @Get('by-region/:slug')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'slug', type: String, required: true })
  findPlansByRegion(@Param('slug') slug: string) {
    return this.plansService.findPlansByRegion(slug);
  }

  @ApiOkResponse({ type: Plan })
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  findOne(@Param('id') id: Plan['id']): Promise<NullableType<Plan>> {
    return this.plansService.findById(id);
  }

  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiOkResponse({ type: Plan })
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  update(
    @Param('id') id: Plan['id'],
    @Body() updatePlanDto: UpdatePlanDto,
  ): Promise<Plan | null> {
    return this.plansService.update(id, updatePlanDto);
  }

  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Delete(':id')
  @ApiParam({ name: 'id', type: String, required: true })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: Plan['id']): Promise<void> {
    return this.plansService.remove(id);
  }

  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post('import-excel')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Upload Excel file with plan data',
    schema: {
      type: 'object',
      required: ['file', 'provider', 'columnMapping'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Excel file (.xlsx, .xls)',
        },
        provider: {
          type: 'string',
          example: 'esimaccess',
          description: 'Provider name applied to all imported plans',
        },
        columnMapping: {
          type: 'string',
          description:
            'JSON string mapping plan fields to Excel column names. ' +
            'Example: {"providerPlanId":"Plan ID","name":"Plan Name","durationDays":"Duration","dataGb":"Data (GB)","costPrice":"Cost","price":"Price","retailPrice":"Retail Price","currency":"Currency"}',
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
        errors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              row: { type: 'number' },
              error: { type: 'string' },
            },
          },
        },
      },
    },
  })
  async importExcel(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: ImportPlansExcelDto,
  ): Promise<ImportResult> {
    if (!file) {
      throw new BadRequestException('Excel file is required');
    }

    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only .xlsx and .xls files are allowed.',
      );
    }

    let columnMapping: PlanColumnMapping;
    try {
      columnMapping = JSON.parse(dto.columnMapping);
    } catch {
      throw new BadRequestException(
        'columnMapping must be a valid JSON string',
      );
    }

    return this.plansImportService.importFromExcel(
      file.buffer,
      dto.provider,
      columnMapping,
      dto.sheet,
    );
  }

  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post('import-esimvn')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description:
      'Upload eSIMvn B2B Price Excel file. Auto-detects sheets and column mapping.',
    schema: {
      type: 'object',
      required: ['file', 'provider'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'eSIMvn B2B Price Excel file (.xlsx)',
        },
        provider: {
          type: 'string',
          example: 'esimvn',
          description: 'Provider name applied to all imported plans',
        },
        sheets: {
          type: 'string',
          description:
            'Comma-separated sheet names to import. Defaults to all: "Daily Unlimited,Pay-as-you-go,Real Unlimited"',
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
        updated: { type: 'number' },
        skipped: { type: 'number' },
        destinationNotFound: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Country names from Excel that could not be matched to a destination',
        },
        errors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              row: { type: 'number' },
              error: { type: 'string' },
            },
          },
        },
      },
    },
  })
  async importEsimvn(
    @UploadedFile() file: Express.Multer.File,
    @Body('provider') provider: string,
    @Body('sheets') sheets?: string,
  ) {
    if (!file) {
      throw new BadRequestException('Excel file is required');
    }
    if (!provider) {
      throw new BadRequestException('provider is required');
    }

    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/octet-stream',
    ];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type: ${file.mimetype}. Only .xlsx and .xls files are allowed.`,
      );
    }

    const sheetList = sheets
      ? sheets.split(',').map((s) => s.trim())
      : undefined;

    return this.plansEsimvnImportService.importFromExcel(
      file.buffer,
      provider,
      sheetList,
    );
  }

  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post('import-gadgetkorea')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description:
      'Upload GadgetKorea Excel file. Provider is auto-set to gadgetkorea, sheets are auto-detected.',
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'GadgetKorea Excel file (.xlsx)',
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
        updated: { type: 'number' },
        skipped: { type: 'number' },
        destinationNotFound: {
          type: 'array',
          items: { type: 'string' },
        },
        errors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              row: { type: 'number' },
              error: { type: 'string' },
            },
          },
        },
      },
    },
  })
  async importGadgetkorea(@UploadedFile() file: Express.Multer.File) {
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
        `Invalid file type: ${file.mimetype}. Only .xlsx and .xls files are allowed.`,
      );
    }

    return this.plansGadgetkoreaImportService.importFromExcel(file.buffer);
  }
}
