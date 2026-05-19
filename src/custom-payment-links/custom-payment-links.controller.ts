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
} from '@nestjs/common';
import { CustomPaymentLinksService } from './custom-payment-links.service';
import { CreateCustomPaymentLinkDto } from './dto/create-custom-payment-link.dto';
import { UpdateCustomPaymentLinkDto } from './dto/update-custom-payment-link.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CustomPaymentLink } from './domain/custom-payment-link';
import { AuthGuard } from '@nestjs/passport';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { infinityPagination } from '../utils/infinity-pagination';
import { FindAllCustomPaymentLinksDto } from './dto/find-all-custom-payment-links.dto';

@ApiTags('Custompaymentlinks')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'custom-payment-links',
  version: '1',
})
export class CustomPaymentLinksController {
  constructor(
    private readonly customPaymentLinksService: CustomPaymentLinksService,
  ) {}

  @Post()
  @ApiCreatedResponse({
    type: CustomPaymentLink,
  })
  create(@Body() createCustomPaymentLinkDto: CreateCustomPaymentLinkDto) {
    return this.customPaymentLinksService.create(createCustomPaymentLinkDto);
  }

  @Get()
  @ApiOkResponse({
    type: InfinityPaginationResponse(CustomPaymentLink),
  })
  async findAll(
    @Query() query: FindAllCustomPaymentLinksDto,
  ): Promise<InfinityPaginationResponseDto<CustomPaymentLink>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    return infinityPagination(
      await this.customPaymentLinksService.findAllWithPagination({
        paginationOptions: {
          page,
          limit,
        },
      }),
      { page, limit },
    );
  }

  @Get(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: CustomPaymentLink,
  })
  findById(@Param('id') id: string) {
    return this.customPaymentLinksService.findById(id);
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: CustomPaymentLink,
  })
  update(
    @Param('id') id: string,
    @Body() updateCustomPaymentLinkDto: UpdateCustomPaymentLinkDto,
  ) {
    return this.customPaymentLinksService.update(
      id,
      updateCustomPaymentLinkDto,
    );
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  remove(@Param('id') id: string) {
    return this.customPaymentLinksService.remove(id);
  }
}
