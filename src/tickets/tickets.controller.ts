import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { QueryTicketDto } from './dto/query-ticket.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Ticket } from './domain/ticket';
import { AuthGuard } from '@nestjs/passport';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { infinityPagination } from '../utils/infinity-pagination';

@ApiTags('Tickets')
@Controller({
  path: 'tickets',
  version: '1',
})
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: Ticket })
  create(@Body() createTicketDto: CreateTicketDto): Promise<Ticket> {
    return this.ticketsService.create(createTicketDto);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: InfinityPaginationResponse(Ticket) })
  async findAll(
    @Query() query: QueryTicketDto,
  ): Promise<InfinityPaginationResponseDto<Ticket>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) limit = 50;

    const [data, count] = await this.ticketsService.findAllWithPagination({
      filterOptions: {
        status: query?.status,
        search: query?.search,
      },
      paginationOptions: { page, limit },
    });

    return infinityPagination(data, { page, limit }, count);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get(':id')
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({ type: Ticket })
  findById(@Param('id') id: number): Promise<Ticket | null> {
    return this.ticketsService.findById(id);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Patch(':id/status')
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({ type: Ticket })
  updateStatus(
    @Param('id') id: number,
    @Body('status') status: string,
  ): Promise<Ticket | null> {
    return this.ticketsService.updateStatus(id, status);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  @ApiParam({ name: 'id', type: Number })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: number): Promise<void> {
    return this.ticketsService.remove(id);
  }
}
