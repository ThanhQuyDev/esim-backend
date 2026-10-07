import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ManufacturerNotesService } from './manufacturer-notes.service';
import { CreateManufacturerNoteDto } from './dto/create-manufacturer-note.dto';
import { UpdateManufacturerNoteDto } from './dto/update-manufacturer-note.dto';
import { FindAllManufacturerNotesDto } from './dto/find-all-manufacturer-notes.dto';
import { ManufacturerNote } from './domain/manufacturer-note';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { infinityPagination } from '../utils/infinity-pagination';

import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
@ApiTags('ManufacturerNotes')
@Controller({
  path: 'manufacturer-notes',
  version: '1',
})
export class ManufacturerNotesController {
  constructor(private readonly notesService: ManufacturerNotesService) {}

  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post()
  @ApiCreatedResponse({ type: ManufacturerNote })
  create(@Body() createDto: CreateManufacturerNoteDto) {
    return this.notesService.create(createDto);
  }

  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Get()
  @ApiOkResponse({ type: InfinityPaginationResponse(ManufacturerNote) })
  async findAll(
    @Query() query: FindAllManufacturerNotesDto,
  ): Promise<InfinityPaginationResponseDto<ManufacturerNote>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    const [data, count] = await this.notesService.findAllWithPagination({
      paginationOptions: { page, limit },
    });

    return infinityPagination(data, { page, limit }, count);
  }

  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Get(':id')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: ManufacturerNote })
  async findById(@Param('id') id: string) {
    const note = await this.notesService.findById(id);
    if (!note) {
      throw new NotFoundException('Manufacturer note not found');
    }
    return note;
  }

  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Patch(':id')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: ManufacturerNote })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateManufacturerNoteDto,
  ) {
    return this.notesService.update(id, updateDto);
  }

  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Delete(':id')
  @ApiParam({ name: 'id', type: String, required: true })
  remove(@Param('id') id: string) {
    return this.notesService.remove(id);
  }
}
