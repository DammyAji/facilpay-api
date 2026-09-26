import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import type { Response } from 'express';
import { Payment, PaymentStatus } from './payment.entity';
import { generateInvoicePdf } from './export/invoice.generator';
import { AppLogger } from '../logger/logger.service';
import { MerchantsService } from '../merchants/merchants.service';
import type { Logger } from 'pino';

@Injectable()
export class InvoiceService {
  private readonly logger: Logger;

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly merchantsService: MerchantsService,
    appLogger: AppLogger,
  ) {
    this.logger = appLogger.child({ module: InvoiceService.name });
  }

  /**
   * Returns an existing invoice token for the payment, or generates and
   * persists a new one. Only completed payments are eligible.
   *
   * @param paymentId  UUID of the payment
   * @returns  The payment record with its invoice token populated
   */
  async getOrCreateInvoiceToken(paymentId: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOneBy({ id: paymentId });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${paymentId} not found`);
    }

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new ConflictException(
        `Invoice is only available for completed payments. Current status: ${payment.status}`,
      );
    }

    if (!payment.invoiceToken) {
      // Generate a cryptographically random URL-safe token
      payment.invoiceToken = randomBytes(32).toString('hex');
      await this.paymentRepository.save(payment);
      this.logger.info(
        { paymentId: payment.id },
        'Invoice token generated and persisted',
      );
    }

    return payment;
  }

  /**
   * Finds a payment by its invoice token.
   * Throws NotFoundException when no payment matches the token.
   *
   * @param token  The invoice token
   * @returns  The associated payment record
   */
  async findPaymentByToken(token: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOneBy({
      invoiceToken: token,
    });

    if (!payment) {
      throw new NotFoundException(
        'Invoice not found or the token is invalid.',
      );
    }

    return payment;
  }

  /**
   * Streams the invoice PDF to an HTTP response.
   *
   * @param payment  The payment record to render
   * @param res  Express Response to pipe the PDF into
   * @param branding  Optional merchant branding (falls back to defaults if not provided)
   */
  async streamInvoicePdf(payment: Payment, res: Response, branding?: {
    displayName: string;
    logo: string | null;
    primaryColor: string;
    supportEmail: string | null;
    supportUrl: string | null;
  }): Promise<void> {
    const invoiceNumber = payment.id.replace(/-/g, '').substring(0, 16).toUpperCase();

    // Get merchant branding if not provided
    let merchantBranding = branding;
    if (!merchantBranding && payment.merchantId) {
      merchantBranding = await this.merchantsService.getBrandingWithDefaults(payment.merchantId);
    }

    const doc = generateInvoicePdf({
      payment,
      invoiceNumber,
      generatedAt: new Date(),
      branding: merchantBranding,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="invoice-${invoiceNumber}.pdf"`,
    );

    doc.pipe(res);

    this.logger.info(
      { paymentId: payment.id },
      'Invoice PDF streamed successfully',
    );
  }
}
