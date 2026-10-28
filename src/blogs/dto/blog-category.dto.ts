import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

/** A blog category's two names (vande #076). */
export class BlogCategoryNamesDto {
  @ApiProperty({ example: 'Du lịch' })
  @IsString()
  @MaxLength(120)
  nameVi: string;

  @ApiProperty({ example: 'Travel' })
  @IsString()
  @MaxLength(120)
  nameEn: string;
}

/** A new category; with `parentId`, a child of that category. */
export class CreateBlogCategoryDto extends BlogCategoryNamesDto {
  @ApiPropertyOptional({ example: 3, nullable: true })
  @IsOptional()
  @IsInt()
  parentId?: number | null;
}
