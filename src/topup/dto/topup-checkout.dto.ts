import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, Length } from 'class-validator';
import { TopupProvider } from './topup-package.dto';

export enum TopupPaymentMethod {
  ONEPAY = 'ONEPAY',
}

/**
 * Payload for `POST /api/v1/topup/checkout`. Mirrors the spec exactly.
 */
export class TopupCheckoutDto {
  @ApiProperty({ type: String, example: '89852245280001354019' })
  @IsString()
  @IsNotEmpty()
  @Length(15, 22)
  iccid!: string;

  @ApiProperty({
    type: String,
    example: 'bonbon-mobile-30days-3gb-topup',
    description: 'Provider-specific package id from the list endpoint',
  })
  @IsString()
  @IsNotEmpty()
  packageId!: string;

  @ApiProperty({ enum: TopupProvider, example: TopupProvider.AIRALO })
  @IsEnum(TopupProvider)
  provider!: TopupProvider;

  @ApiProperty({
    enum: TopupPaymentMethod,
    example: TopupPaymentMethod.ONEPAY,
  })
  @IsEnum(TopupPaymentMethod)
  paymentMethod!: TopupPaymentMethod;
}
