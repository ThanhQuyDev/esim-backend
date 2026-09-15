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
  Request,
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
import { Roles } from '../roles/roles.decorator';
import { RolesGuard } from '../roles/roles.guard';
import { RoleEnum } from '../roles/roles.enum';
import { UsersService } from '../users/users.service';
import { clientIp } from './ticket-spam-guard';

@ApiTags('Tickets')
@Controller({
  path: 'tickets',
  version: '1',
})
export class TicketsController {
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly usersService: UsersService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: Ticket })
  create(
    @Body() createTicketDto: CreateTicketDto,
    @Request() req: Parameters<typeof clientIp>[0],
  ): Promise<Ticket> {
    // The IP feeds the server-side spam limit (#033).
    return this.ticketsService.create(createTicketDto, clientIp(req));
  }

  /**
   * Every ticket in the system — customer emails, ICCIDs, order ids and
   * attachments. Admin only: this used to accept any authenticated user, which
   * let a signed-in customer or partner read everyone else's support history.
   * A user's own tickets are served by {@link findMine}.
   */
  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
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

  /** Tickets opened with the signed-in user's own email address. */
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('mine')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: InfinityPaginationResponse(Ticket) })
  async findMine(
    @Request() req: { user: { id: number } },
    @Query() query: QueryTicketDto,
  ): Promise<InfinityPaginationResponseDto<Ticket>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) limit = 50;

    const user = await this.usersService.findById(req.user.id);
    const email = user?.email;
    if (!email) {
      return infinityPagination([], { page, limit }, 0);
    }

    const [data, count] = await this.ticketsService.findAllWithPagination({
      filterOptions: { status: query?.status, customerEmail: email },
      paginationOptions: { page, limit },
    });

    return infinityPagination(data, { page, limit }, count);
  }

  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
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
