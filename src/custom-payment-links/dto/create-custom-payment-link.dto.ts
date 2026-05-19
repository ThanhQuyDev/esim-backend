import { UserDto } from '../../users/dto/user.dto';

import {
  // decorators here

  IsString,
  IsNumber,
  IsOptional,
} from 'class-validator';

import {
  // decorators here
  ApiProperty,
} from '@nestjs/swagger';

export class CreateCustomPaymentLinkDto {
  createdBy?: UserDto | null;

  @ApiProperty({
    required: false,
    type: () => String,
  })
  @IsOptional()
  @IsString()
  paymentId?: string | null;

  @ApiProperty({
    required: true,
    type: () => String,
  })
  @IsString()
  status: string;

  @ApiProperty({
    required: false,
    type: () => String,
  })
  @IsOptional()
  @IsString()
  paymentUrl?: string | null;

  @ApiProperty({
    required: true,
    type: () => String,
  })
  @IsString()
  description: string;

  @ApiProperty({
    required: true,
    type: () => String,
  })
  @IsString()
  currency: string;

  @ApiProperty({
    required: true,
    type: () => Number,
  })
  @IsNumber()
  amount: number;

  @ApiProperty({
    required: true,
    type: () => String,
  })
  @IsString()
  customerEmail: string;

  @ApiProperty({
    required: true,
    type: () => String,
  })
  @IsString()
  virtualOrderId: string;

  // Don't forget to use the class-validator decorators in the DTO properties.
}
