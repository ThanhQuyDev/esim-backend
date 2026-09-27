import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

/** The account a partner wants their payouts sent to (#005). */
export class RequestBankAccountChangeDto {
  @ApiProperty({ example: 'Vietcombank' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  bankName!: string;

  @ApiProperty({ example: '0123456789' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  bankAccountNumber!: string;

  @ApiProperty({ example: 'TRAN THU HA' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  bankAccountHolder!: string;

  @ApiPropertyOptional({ example: 'Chi nhánh Tân Bình' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  bankBranch?: string;
}

export class ConfirmBankAccountChangeDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  otp!: string;
}
