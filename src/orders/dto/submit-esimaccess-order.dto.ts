import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class EsimAccessPackageInfoDto {
  @ApiProperty({ example: '7aa948d363' })
  @IsString()
  @IsNotEmpty()
  packageCode: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(1)
  count: number;

  @ApiProperty({ example: 15000 })
  @IsNumber()
  price: number;
}

export class SubmitEsimAccessOrderDto {
  @ApiProperty({ example: 'your_txn_id' })
  @IsString()
  @IsNotEmpty()
  transactionId: string;

  @ApiProperty({ example: 15000 })
  @IsNumber()
  amount: number;

  @ApiProperty({ type: [EsimAccessPackageInfoDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EsimAccessPackageInfoDto)
  packageInfoList: EsimAccessPackageInfoDto[];
}

export class EsimAccessOrderResponseDto {
  @ApiProperty()
  orderNo: string;

  @ApiProperty()
  transactionId: string;
}
