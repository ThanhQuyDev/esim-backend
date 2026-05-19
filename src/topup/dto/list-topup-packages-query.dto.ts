import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

/**
 * Query parameters accepted by `GET /api/v1/topup/packages`.
 */
export class ListTopupPackagesQueryDto {
  @ApiProperty({
    type: String,
    example: '89852245280001354019',
    description: 'ICCID of the eSIM to top up',
  })
  @IsString()
  @IsNotEmpty()
  @Length(15, 22)
  iccid!: string;
}
