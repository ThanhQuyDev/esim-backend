import { Injectable, Logger } from '@nestjs/common';
import { ChatAutomationRepository } from './infrastructure/persistence/relational/repositories/chat-automation.repository';
import { ChatAutomation } from './domain/chat-automation';
import { CreateChatAutomationDto } from './dto/create-chat-automation.dto';
import { UpdateChatAutomationDto } from './dto/update-chat-automation.dto';
import { ChatAutomationType } from './chat-automations.enum';
import { NullableType } from '../utils/types/nullable.type';

@Injectable()
export class ChatAutomationsService {
  private readonly logger = new Logger(ChatAutomationsService.name);

  constructor(
    private readonly chatAutomationRepository: ChatAutomationRepository,
  ) {}

  findAll(): Promise<ChatAutomation[]> {
    return this.chatAutomationRepository.findAll();
  }

  findByType(type: string): Promise<NullableType<ChatAutomation>> {
    return this.chatAutomationRepository.findByType(type);
  }

  create(dto: CreateChatAutomationDto): Promise<ChatAutomation> {
    return this.chatAutomationRepository.create({
      type: dto.type,
      message: dto.message,
      isActive: dto.isActive ?? true,
    });
  }

  async update(
    type: ChatAutomationType,
    dto: UpdateChatAutomationDto,
  ): Promise<ChatAutomation | null> {
    const existing = await this.chatAutomationRepository.findByType(type);
    if (!existing) return null;
    return this.chatAutomationRepository.update(existing.id, {
      message: dto.message,
      isActive: dto.isActive,
    });
  }

  /**
   * Get the active welcome message (for joinRoom trigger).
   */
  async getWelcomeMessage(): Promise<string | null> {
    const automation = await this.chatAutomationRepository.findByType(
      ChatAutomationType.WELCOME,
    );
    if (!automation || !automation.isActive) return null;
    return automation.message;
  }

  /**
   * Get the active first-response message (for first user message trigger).
   */
  async getFirstResponseMessage(): Promise<string | null> {
    const automation = await this.chatAutomationRepository.findByType(
      ChatAutomationType.FIRST_RESPONSE,
    );
    if (!automation || !automation.isActive) return null;
    return automation.message;
  }
}
