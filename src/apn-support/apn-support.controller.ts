import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
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

    const [data, count] = await this.apnSupportService.findAllWithPagination({
      paginationOptions: { page, limit },
    });

    return infinityPagination(data, { page, limit }, count);
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
