import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { EmailTemplatesService } from './email-templates.service';
import { EmailTemplatesController } from './email-templates.controller';
import { EmailTemplateEntity } from './infrastructure/persistence/relational/entities/email-template.entity';
import { EmailTemplateRepository } from './infrastructure/persistence/email-template.repository';
import { EmailTemplatesRelationalRepository } from './infrastructure/persistence/relational/repositories/email-template.repository';

@Module({
  imports: [TypeOrmModule.forFeature([EmailTemplateEntity]), ConfigModule],
  controllers: [EmailTemplatesController],
  providers: [
    EmailTemplatesService,
    {
      provide: EmailTemplateRepository,
      useClass: EmailTemplatesRelationalRepository,
    },
  ],
  exports: [EmailTemplatesService],
})
export class EmailTemplatesModule {}
