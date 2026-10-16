import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import { SyncOrchestratorService } from './sync-orchestrator.service';

/**
 * "Cập nhật lại toàn bộ sản phẩm" on the suppliers page (doitac-1410 #074):
 * run the 6-hourly catalogue sync now, and see how it is going.
 */
@ApiTags('Providers')
@ApiBearerAuth()
@Roles(RoleEnum.admin)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'providers/full-sync', version: '1' })
export class FullSyncController {
  constructor(private readonly orchestrator: SyncOrchestratorService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  status() {
    return this.orchestrator.getStatus();
  }

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  start() {
    return this.orchestrator.startManualSync();
  }
}
