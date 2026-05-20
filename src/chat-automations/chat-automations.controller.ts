import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import { ChatAutomationsService } from './chat-automations.service';
import { ChatAutomation } from './domain/chat-automation';
import { CreateChatAutomationDto } from './dto/create-chat-automation.dto';
import { UpdateChatAutomationDto } from './dto/update-chat-automation.dto';
import { ChatAutomationType } from './chat-automations.enum';

@ApiBearerAuth()
@ApiTags('Admin Chat Automations')
@Roles(RoleEnum.admin)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({
  path: 'admin/chat-automations',
  version: '1',
})
export class AdminChatAutomationsController {
  constructor(
    private readonly chatAutomationsService: ChatAutomationsService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all chat automation configurations' })
  @ApiOkResponse({ type: [ChatAutomation] })
  findAll(): Promise<ChatAutomation[]> {
    return this.chatAutomationsService.findAll();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new chat automation (WELCOME or FIRST_RESPONSE)',
  })
  @ApiOkResponse({ type: ChatAutomation })
  create(@Body() dto: CreateChatAutomationDto): Promise<ChatAutomation> {
    return this.chatAutomationsService.create(dto);
  }

  @Put(':type')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a chat automation by type' })
  @ApiParam({ name: 'type', enum: ChatAutomationType })
  @ApiOkResponse({ type: ChatAutomation })
  update(
    @Param('type') type: ChatAutomationType,
    @Body() dto: UpdateChatAutomationDto,
  ): Promise<ChatAutomation | null> {
    return this.chatAutomationsService.update(type, dto);
  }
}
