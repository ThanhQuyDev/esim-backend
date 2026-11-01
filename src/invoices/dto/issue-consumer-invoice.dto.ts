import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * A VAT invoice issued to the buyer as a consumer (doitac-3010 #044): only
 * its number, no company details.
 */
export class IssueConsumerInvoiceDto {
  @ApiProperty({ example: '0001234', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  invoiceNumber: string;
}
