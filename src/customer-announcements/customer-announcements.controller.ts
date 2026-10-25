import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import {
  AnnouncementAudienceDto,
  CreateCustomerAnnouncementDto,
  PreviewCustomerAnnouncementDto,
} from './customer-announcement.dto';
import { CustomerAnnouncementsService } from './customer-announcements.service';

/** "Thông báo khách hàng" in the CMS (vande #072). Admins only. */
@ApiTags('Customer announcements')
@ApiBearerAuth()
@Roles(RoleEnum.admin)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'admin/customer-announcements', version: '1' })
export class CustomerAnnouncementsController {
  constructor(private readonly service: CustomerAnnouncementsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  list() {
    return this.service.list();
  }

  /** "Dự kiến N khách hàng nhận". */
  @Get('audience-count')
  @HttpCode(HttpStatus.OK)
  audienceCount(@Query() query: AnnouncementAudienceDto) {
    return this.service.countAudience(query.audience, query.period);
  }

  /** The email as it will arrive, for the preview beside the editor. */
  @Post('preview')
  @HttpCode(HttpStatus.OK)
  preview(@Body() dto: PreviewCustomerAnnouncementDto) {
    return this.service.preview(dto.subject, dto.body);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateCustomerAnnouncementDto,
    @Request() req: { user: { id: number } },
  ) {
    return this.service.create(dto, { id: Number(req.user.id) });
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id', ParseIntPipe) id: number) {
    return this.service.cancel(id);
  }
}
