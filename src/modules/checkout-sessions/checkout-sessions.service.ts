import {
  Injectable,
  NotFoundException,
  BadRequestException,
  GoneException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { CheckoutSession, CheckoutSessionStatus, LineItem } from './entities/checkout-session.entity';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { MerchantsService } from '../merchants/merchants.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { PaymentsService } from '../payments/payments.service';
import { Payment, PaymentStatus } from '../payments/payment.entity';
import { AppLogger } from '../logger/logger.service';
import type { Logger } from 'pino';

@Injectable()
export class CheckoutSessionsService {
  private readonly logger: Logger;
  private readonly baseUrl: string;

  constructor(
    @InjectRepository(CheckoutSession)
    private readonly sessionRepo: Repository<CheckoutSession>,
    private readonly merchantsService: MerchantsService,
    private readonly webhooksService: WebhooksService,
    private readonly paymentsService: PaymentsService,
    private readonly configService: ConfigService,
    appLogger: AppLogger,
  ) {
    this.logger = appLogger.child({ module: CheckoutSessionsService.name });
    this.baseUrl = this.configService.get('CHECKOUT_BASE_URL', 'https://checkout.facilpay.com');
  }

  /**
   * Create a new checkout session
   */
  async create(merchantId: string, dto: CreateCheckoutSessionDto): Promise<CheckoutSession> {
    // Validate line items
    if (!dto.lineItems || dto.lineItems.length === 0) {
      throw new BadRequestException('At least one line item is required');
    }

    // Calculate total from line items (server-side)
    const total = this.calculateTotal(dto.lineItems);

    // Generate public ID (URL-safe, 24 chars)
    const publicId = this.generatePublicId();

    // Calculate expiry
    const expiresInMinutes = dto.expiresInMinutes || 30;
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expiresInMinutes);

    const session = this.sessionRepo.create({
      publicId,
      merchantId,
      lineItems: dto.lineItems as LineItem[],
      currency: dto.currency.toUpperCase(),
      total,
      customerId: dto.customerId || null,
      customerEmail: dto.customerEmail || null,
      successUrl: dto.successUrl,
      cancelUrl: dto.cancelUrl,
      expiresAt,
      status: CheckoutSessionStatus.OPEN,
    });

    const saved = await this.sessionRepo.save(session);

    this.logger.info(
      { sessionId: saved.id, publicId, merchantId, total },
      'Checkout session created',
    );

    return saved;
  }

  /**
   * Get a checkout session by ID (merchant's own session only)
   */
  async findById(id: string, merchantId: string): Promise<CheckoutSession> {
    const session = await this.sessionRepo.findOne({
      where: { id, merchantId },
    });

    if (!session) {
      throw new NotFoundException(`Checkout session ${id} not found`);
    }

    return session;
  }

  /**
   * Get checkout session by public ID (public endpoint)
   */
  async findByPublicId(publicId: string): Promise<CheckoutSession> {
    const session = await this.sessionRepo.findOne({
      where: { publicId },
    });

    if (!session) {
      throw new NotFoundException('Checkout session not found');
    }

    return session;
  }

  /**
   * Get public checkout session with branding
   */
  async getPublicSession(publicId: string): Promise<{
    session: CheckoutSession;
    branding: { displayName: string; logo: string | null; primaryColor: string };
  }> {
    const session = await this.findByPublicId(publicId);

    // Check if expired
    const isExpired = session.status === CheckoutSessionStatus.EXPIRED || 
                      (session.status === CheckoutSessionStatus.OPEN && new Date() > session.expiresAt);

    if (isExpired && session.status !== CheckoutSessionStatus.COMPLETE) {
      throw new GoneException('This checkout session has expired');
    }

    const branding = await this.merchantsService.getBrandingWithDefaults(session.merchantId);

    return { session, branding };
  }

  /**
   * Expire a checkout session manually
   */
  async expire(id: string, merchantId: string): Promise<CheckoutSession> {
    const session = await this.findById(id, merchantId);

    if (session.status !== CheckoutSessionStatus.OPEN) {
      throw new BadRequestException('Only OPEN sessions can be expired');
    }

    session.status = CheckoutSessionStatus.EXPIRED;
    const updated = await this.sessionRepo.save(session);

    // Emit webhook
    await this.webhooksService.dispatchEventToMerchant(
      merchantId,
      'checkout.session.expired',
      {
        sessionId: session.id,
        publicId: session.publicId,
        expiredAt: updated.updatedAt,
      },
    );

    this.logger.info({ sessionId: session.id }, 'Checkout session expired manually');

    return updated;
  }

  /**
   * Complete a checkout session by creating a payment
   */
  async completeSession(
    publicId: string,
    payerEmail: string,
    metadata?: Record<string, string>,
  ): Promise<{ session: CheckoutSession; payment: Payment }> {
    const { session, branding } = await this.getPublicSession(publicId);

    if (session.status !== CheckoutSessionStatus.OPEN) {
      throw new BadRequestException(`Session is not open (status: ${session.status})`);
    }

    // Create payment using PaymentsService
    const payment = await this.paymentsService.create(
      {
        amount: Number(session.total) / 100, // Convert from cents
        currency: session.currency,
        merchantId: session.merchantId,
        description: session.lineItems.map(item => `${item.quantity}x ${item.name}`).join(', '),
        payerEmail,
        customerId: session.customerId ?? undefined,
        metadata: {
          ...metadata,
          checkoutSessionId: session.id,
          checkoutPublicId: session.publicId,
        },
      },
    );

    // Update session with payment ID and mark as complete
    session.paymentId = payment.id;
    session.status = CheckoutSessionStatus.COMPLETE;
    await this.sessionRepo.save(session);

    // Emit webhook
    await this.webhooksService.dispatchEventToMerchant(
      session.merchantId,
      'checkout.session.completed',
      {
        sessionId: session.id,
        publicId: session.publicId,
        paymentId: payment.id,
        completedAt: new Date().toISOString(),
        customerEmail: payerEmail,
      },
    );

    this.logger.info(
      { sessionId: session.id, paymentId: payment.id },
      'Checkout session completed',
    );

    return { session, payment };
  }

  /**
   * List checkout sessions for a merchant
   */
  async findAll(
    merchantId: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<{ sessions: CheckoutSession[]; total: number }> {
    const { limit = 20, offset = 0 } = options;

    const [sessions, total] = await this.sessionRepo.findAndCount({
      where: { merchantId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return { sessions, total };
  }

  /**
   * Calculate total from line items (server-side)
   */
  private calculateTotal(lineItems: LineItemDto[]): number {
    return lineItems.reduce((sum, item) => {
      return sum + item.quantity * item.unitAmount;
    }, 0);
  }

  /**
   * Generate a URL-safe public ID
   */
  private generatePublicId(): string {
    // Generate 24 character alphanumeric string
    return randomBytes(16).toString('base64url');
  }

  /**
   * Cron job to expire stale sessions
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleCron(): Promise<void> {
    await this.expireStaleSessions();
  }

  /**
   * Check and expire stale sessions (called by cron)
   */
  async expireStaleSessions(): Promise<number> {
    // First get expired sessions to send webhooks
    const expiredSessions = await this.sessionRepo.find({
      where: {
        status: CheckoutSessionStatus.OPEN,
      },
    });

    const now = new Date();
    const staleSessions = expiredSessions.filter(s => new Date(s.expiresAt) < now);

    // Update status
    const result = await this.sessionRepo
      .createQueryBuilder()
      .update(CheckoutSession)
      .set({ status: CheckoutSessionStatus.EXPIRED })
      .where('status = :status', { status: CheckoutSessionStatus.OPEN })
      .andWhere('expiresAt < :now', { now })
      .execute();

    const affected = result.affected || 0;
    if (affected > 0) {
      this.logger.info({ count: affected }, 'Expired stale checkout sessions');

      // Send webhooks for expired sessions
      for (const session of staleSessions) {
        try {
          await this.webhooksService.dispatchEventToMerchant(
            session.merchantId,
            'checkout.session.expired',
            {
              sessionId: session.id,
              publicId: session.publicId,
              expiredAt: now,
            },
          );
        } catch (error) {
          this.logger.error({ error, sessionId: session.id }, 'Failed to send expiration webhook');
        }
      }
    }
    return affected;
  }
}