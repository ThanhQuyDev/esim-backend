import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateInvoiceForOrderDto {
  @ApiProperty({ example: 'Công ty TNHH ABC', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  companyName: string;

  @ApiProperty({ example: '0312345678', maxLength: 32 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  taxCode: string;

  @ApiProperty({
    example: '123 Nguyen Hue, District 1, Ho Chi Minh City',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address: string;

  @ApiProperty({ example: '+84901234567', maxLength: 20 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  invoicePhone: string;

  @ApiProperty({ example: 'finance@example.com' })
  @IsEmail()
  @IsNotEmpty()
  invoiceEmail: string;
}
