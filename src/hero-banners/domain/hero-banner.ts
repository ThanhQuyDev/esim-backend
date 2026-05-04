import { FileType } from '../../files/domain/file';
import { ApiProperty } from '@nestjs/swagger';

export class HeroBanner {
  @ApiProperty({
    type: () => Boolean,
    nullable: false,
  })
  active: boolean;

  @ApiProperty({
    type: () => FileType,
    nullable: true,
  })
  image?: FileType | null;

  @ApiProperty({
    type: String,
  })
  id: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
