import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** "Topup hộ khách" — the package picked from the list (doitac-1410 #039). */
export class PartnerEsimTopupDto {
  @ApiProperty({ type: String })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn gói topup.' })
  @MaxLength(128)
  packageId!: string;
}
