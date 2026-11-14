import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import {
  CloudinaryPurpose,
  CloudinaryUploadTicket,
  cloudinaryUploadTicket,
} from './cloudinary-upload';

/**
 * Signed Cloudinary uploads (security 15/11/2026), one ticket per upload:
 * - `cms`: images in the CMS, for admins and staff only;
 * - `chat`: support-chat files, for anyone signed in;
 * - `ticket`: attachments on the support form, which guests may send too.
 * Rate-limited in nginx like /files/upload.
 */
@ApiTags('Files')
@Controller({ path: 'files/cloudinary-signature', version: '1' })
export class CloudinaryController {
  @ApiBearerAuth()
  @Roles(RoleEnum.admin, RoleEnum.author)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post('cms')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse()
  cms(): CloudinaryUploadTicket {
    return this.ticket('cms');
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse()
  chat(): CloudinaryUploadTicket {
    return this.ticket('chat');
  }

  @Post('ticket')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse()
  supportTicket(): CloudinaryUploadTicket {
    return this.ticket('ticket');
  }

  private ticket(purpose: CloudinaryPurpose): CloudinaryUploadTicket {
    const ticket = cloudinaryUploadTicket(purpose);
    if (!ticket) {
      throw new ServiceUnavailableException('Chưa cấu hình Cloudinary.');
    }
    return ticket;
  }
}
