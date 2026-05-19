import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

/**
 * Lightweight reference to an Order, used by other modules' DTOs (e.g. Invoice
 * create/update payloads) when only the foreign-key id is needed.
 */
export class OrderDto {
  @ApiProperty({
    type: Number,
    example: 1,
  })
  @IsNotEmpty()
  id: number;
}
