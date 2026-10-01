import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import { AuthPagesService } from './auth-pages.service';
import {
  AuthPageSettingDto,
  UpdateAuthPageSettingDto,
} from './dto/auth-page-setting.dto';

/**
 * Read side is public on purpose: it feeds the sign-in page, which by definition
 * renders before anyone has a token. Nothing here is sensitive — it is the copy
 * and images shown to whoever opens that page (#006).
 */
@ApiTags('AuthPages')
@Controller({ path: 'auth-page-settings', version: '1' })
export class AuthPageSettingsPublicController {
  constructor(private readonly service: AuthPagesService) {}

  @ApiOkResponse({ type: AuthPageSettingDto })
  @Get(':mode')
  @HttpCode(HttpStatus.OK)
  async findOne(
    @Param('mode') mode: string,
  ): Promise<{ data: AuthPageSettingDto }> {
    return { data: await this.service.findOne(mode) };
  }
}

@ApiTags('AuthPages')
@ApiBearerAuth()
@Roles(RoleEnum.admin)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'auth-page-settings', version: '1' })
export class AuthPageSettingsController {
  constructor(private readonly service: AuthPagesService) {}

  @ApiOkResponse({ type: [AuthPageSettingDto] })
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(): Promise<{ data: AuthPageSettingDto[] }> {
    return { data: await this.service.findAll() };
  }

  @ApiOkResponse({ type: AuthPageSettingDto })
  @Put(':mode')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('mode') mode: string,
    @Body() dto: UpdateAuthPageSettingDto,
  ): Promise<{ data: AuthPageSettingDto }> {
    return { data: await this.service.update(mode, dto) };
  }
}
