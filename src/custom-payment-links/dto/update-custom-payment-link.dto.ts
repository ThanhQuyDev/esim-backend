// Don't forget to use the class-validator decorators in the DTO properties.
// import { Allow } from 'class-validator';

import { PartialType } from '@nestjs/swagger';
import { CreateCustomPaymentLinkDto } from './create-custom-payment-link.dto';

export class UpdateCustomPaymentLinkDto extends PartialType(
  CreateCustomPaymentLinkDto,
) {}
