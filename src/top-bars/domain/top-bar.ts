import { FileType } from '../../files/domain/file';
import { ApiProperty } from '@nestjs/swagger';

export class TopBar {
  @ApiProperty({
    type: () => String,
    nullable: false,
  })
  url: string;

  @ApiProperty({
    type: () => String,
    nullable: false,
  })
  buttonContent: string;

  @ApiProperty({
    type: () => String,
    nullable: false,
  })
  title: string;

  @ApiProperty({
    type: () => String,
    nullable: false,
  })
  titleVi: string;

  @ApiProperty({
    type: () => FileType,
    nullable: true,
  })
  icon?: FileType | null;

  @ApiProperty({
    type: String,
  })
  id: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
