// Don't forget to use the class-validator decorators in the DTO properties.
// import { Allow } from 'class-validator';

import { PartialType } from '@nestjs/swagger';
import { CreateWhyChooseUsDto } from './create-why-choose-us.dto';

export class UpdateWhyChooseUsDto extends PartialType(CreateWhyChooseUsDto) {}
