import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

/**
 * An admin's verdict on a pending custom payment link (#056).
 *
 * A boolean rather than a free status string, so the endpoint can only ever
 * produce PAID or FAILED — never move a link back to PENDING or to something
 * the tabs do not know about.
 */
export class ConfirmCustomPaymentLinkDto {
  @ApiProperty({
    type: Boolean,
    description: 'true = Đã thanh toán, false = Thanh toán thất bại',
  })
  @IsBoolean()
  isPaid: boolean;
}
