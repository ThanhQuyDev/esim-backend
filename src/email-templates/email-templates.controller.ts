import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  UseGuards,
  HttpStatus,
  HttpCode,
  Param,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../roles/roles.guard';
import { EmailTemplatesService } from './email-templates.service';
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto';
import {
  PreviewEmailTemplateDto,
  PreviewEmailTemplateResponseDto,
} from './dto/preview-email-template.dto';
import { EmailTemplate } from './domain/email-template';

@ApiTags('Email Templates')
@ApiBearerAuth()
@Roles(RoleEnum.admin)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'email-templates', version: '1' })
export class EmailTemplatesController {
  constructor(private readonly emailTemplatesService: EmailTemplatesService) {}

  @ApiOkResponse({ type: EmailTemplate })
  @Get('esim-purchase')
  @HttpCode(HttpStatus.OK)
  findEsimPurchase(): Promise<EmailTemplate | null> {
    return this.emailTemplatesService.findByName('esim_purchase');
  }

  @ApiOkResponse({ type: EmailTemplate })
  @Patch('esim-purchase')
  @HttpCode(HttpStatus.OK)
  updateEsimPurchase(
    @Body() dto: UpdateEmailTemplateDto,
  ): Promise<EmailTemplate> {
    return this.emailTemplatesService.updateByName('esim_purchase', dto);
  }

  @ApiOkResponse({ type: PreviewEmailTemplateResponseDto })
  @Post('esim-purchase/preview')
  @HttpCode(HttpStatus.OK)
  previewEsimPurchase(
    @Body() dto: PreviewEmailTemplateDto,
  ): Promise<PreviewEmailTemplateResponseDto> {
    return this.emailTemplatesService.previewByName('esim_purchase', dto);
  }

  /**
   * Every seeded template (#L020). The routes above only ever exposed
   * `esim_purchase`, so the partner approval/rejection and invoice emails sat
   * in the database with no way to edit them from the CMS.
   */
  @ApiOkResponse({ type: [EmailTemplate] })
  @Get()
  @HttpCode(HttpStatus.OK)
  findAll(): Promise<EmailTemplate[]> {
    return this.emailTemplatesService.findAll();
  }

  @ApiOkResponse({ type: EmailTemplate })
  @Get(':name')
  @HttpCode(HttpStatus.OK)
  findOne(@Param('name') name: string): Promise<EmailTemplate> {
    return this.emailTemplatesService.getByName(name);
  }

  @ApiOkResponse({ type: EmailTemplate })
  @Patch(':name')
  @HttpCode(HttpStatus.OK)
  update(
    @Param('name') name: string,
    @Body() dto: UpdateEmailTemplateDto,
  ): Promise<EmailTemplate> {
    return this.emailTemplatesService.updateByName(name, dto);
  }

  @ApiOkResponse({ type: PreviewEmailTemplateResponseDto })
  @Post(':name/preview')
  @HttpCode(HttpStatus.OK)
  preview(
    @Param('name') name: string,
    @Body() dto: PreviewEmailTemplateDto,
  ): Promise<PreviewEmailTemplateResponseDto> {
    return this.emailTemplatesService.previewByName(name, dto);
  }
}
