import { OrderDto } from '../../orders/dto/order.dto';

import {
  // decorators here
  Type,
} from 'class-transformer';

import {
  // decorators here

  ValidateNested,
  IsNotEmptyObject,
  IsString,
  IsOptional,
  MaxLength,
} from 'class-validator';

import {
  // decorators here
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

export class CreateInvoiceDto {
  @ApiProperty({
    required: true,
    type: () => String,
  })
  @IsString()
  status: string;

  @ApiProperty({
    required: true,
    type: () => String,
  })
  @IsString()
  invoicePhone: string;

  @ApiProperty({
    required: true,
    type: () => String,
  })
  @IsString()
  invoiceEmail: string;

  @ApiProperty({
    required: true,
    type: () => String,
  })
  @IsString()
  address: string;

  @ApiProperty({
    required: true,
    type: () => String,
  })
  @IsString()
  taxCode: string;

  @ApiProperty({
    required: true,
    type: () => String,
  })
  @IsString()
  companyName: string;

  @ApiProperty({
    required: true,
    type: () => OrderDto,
  })
  @ValidateNested()
  @Type(() => OrderDto)
  @IsNotEmptyObject()
  order: OrderDto;

  // Don't forget to use the class-validator decorators in the DTO properties.

  /** "Số hóa đơn VAT", required to issue (doitac-3010 #044). */
  @ApiPropertyOptional({ type: String, example: '0001234', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  invoiceNumber?: string;
}
