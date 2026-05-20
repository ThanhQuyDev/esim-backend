import { OrdersService } from '../orders/orders.service';
import { Order } from '../orders/domain/order';

import {
  // common
  ConflictException,
  Injectable,
  HttpStatus,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { InvoiceRepository } from './infrastructure/persistence/invoice.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { Invoice } from './domain/invoice';
import { InvoiceStatus } from './invoices.enum';
import { MailService } from '../mail/mail.service';

export interface CreateInvoiceForOrderInput {
  companyName: string;
  taxCode: string;
  address: string;
  invoiceEmail: string;
}

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private readonly orderService: OrdersService,

    // Dependencies here
    private readonly invoiceRepository: InvoiceRepository,
    private readonly mailService: MailService,
  ) {}

  async create(createInvoiceDto: CreateInvoiceDto) {
    // Do not remove comment below.
    // <creating-property />

    const orderObject = await this.orderService.findById(
      createInvoiceDto.order.id,
    );
    if (!orderObject) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          order: 'notExists',
        },
      });
    }
    const order = orderObject;

    return this.invoiceRepository.create({
      // Do not remove comment below.
      // <creating-property-payload />
      status: createInvoiceDto.status,

      invoiceEmail: createInvoiceDto.invoiceEmail,

      address: createInvoiceDto.address,

      taxCode: createInvoiceDto.taxCode,

      companyName: createInvoiceDto.companyName,

      orderId: order.id,
      order,
    });
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.invoiceRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: Invoice['id']) {
    return this.invoiceRepository.findById(id);
  }

  findByIds(ids: Invoice['id'][]) {
    return this.invoiceRepository.findByIds(ids);
  }

  async update(
    id: Invoice['id'],

    updateInvoiceDto: UpdateInvoiceDto,
  ) {
    // Do not remove comment below.
    // <updating-property />

    let order: Order | undefined = undefined;

    if (updateInvoiceDto.order) {
      const orderObject = await this.orderService.findById(
        updateInvoiceDto.order.id,
      );
      if (!orderObject) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            order: 'notExists',
          },
        });
      }
      order = orderObject;
    }

    // Check if status is transitioning to ISSUED — trigger email delivery
    const previousInvoice = await this.invoiceRepository.findById(id);
    const isTransitioningToIssued =
      updateInvoiceDto.status === InvoiceStatus.ISSUED &&
      previousInvoice?.status !== InvoiceStatus.ISSUED;

    const updated = await this.invoiceRepository.update(id, {
      // Do not remove comment below.
      // <updating-property-payload />
      status: updateInvoiceDto.status,

      invoiceEmail: updateInvoiceDto.invoiceEmail,

      address: updateInvoiceDto.address,

      taxCode: updateInvoiceDto.taxCode,

      companyName: updateInvoiceDto.companyName,

      order,
    });

    // Part 12 Feature 1.1: Auto-send invoice email when status changes to ISSUED
    if (isTransitioningToIssued && updated) {
      void this.sendInvoiceIssuedEmail(updated);
    }

    return updated;
  }

  /**
   * Part 12 Feature 1.1 — Send invoice confirmation email to the customer's
   * invoiceEmail when the invoice status transitions to ISSUED.
   */
  private async sendInvoiceIssuedEmail(invoice: Invoice): Promise<void> {
    try {
      const order =
        invoice.order ?? (await this.orderService.findById(invoice.orderId));
      if (!order) {
        this.logger.warn(
          `Cannot send invoice email: order ${invoice.orderId} not found`,
        );
        return;
      }

      await this.mailService.sendInvoiceIssued({
        to: invoice.invoiceEmail,
        orderNumber: order.orderNumber,
        companyName: invoice.companyName,
        taxCode: invoice.taxCode,
        address: invoice.address,
        totalAmountVnd:
          Number(order.vndPrice) || Number(order.payableVndPrice) || 0,
      });

      this.logger.log(
        `Invoice ISSUED email sent to ${invoice.invoiceEmail} for order ${order.orderNumber}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to send invoice ISSUED email for invoice ${invoice.id}: ${(err as Error).message}`,
      );
    }
  }

  remove(id: Invoice['id']) {
    return this.invoiceRepository.remove(id);
  }

  /**
   * Feature 1.2 — Create an invoice request linked 1:1 to an existing order.
   * Throws if the order doesn't exist or already has an invoice.
   */
  async createForOrder(
    orderId: number,
    input: CreateInvoiceForOrderInput,
  ): Promise<Invoice> {
    const order = await this.orderService.findById(orderId);
    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    const existing = await this.invoiceRepository.findByOrderId(orderId);
    if (existing) {
      throw new ConflictException(
        `Invoice already exists for order ${orderId}`,
      );
    }

    const created = await this.invoiceRepository.create({
      status: InvoiceStatus.PENDING,
      companyName: input.companyName,
      taxCode: input.taxCode,
      address: input.address,
      invoiceEmail: input.invoiceEmail,
      orderId: order.id,
      order,
    });

    this.logger.log(
      `Invoice created for order ${order.orderNumber} (id=${order.id})`,
    );
    return created;
  }

  findByOrderId(orderId: number) {
    return this.invoiceRepository.findByOrderId(orderId);
  }
}
