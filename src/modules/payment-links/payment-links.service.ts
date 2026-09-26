import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  GoneException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes, createHash } from 'crypto';
import { PaymentLink } from './payment-link.entity';
import { PaymentLinkEvent, PaymentLinkEventType } from './entities/payment-link-event.entity';
import { CreatePaymentLinkDto } from './dto/create-payment-link.dto';
import { UpdatePaymentLinkDto } from './dto/update-payment-link.dto';
import { GetAnalyticsDto, AnalyticsBucketDto } from './dto/get-analytics.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { AppLogger } from '../logger/logger.service';
import type { Logger } from 'pino';

@Injectable()
export class PaymentLinksService {
  private readonly logger: Logger;
  private readonly viewDebounceWindowMs = 60 * 60 * 1000; // 1 hour

  constructor(
    @InjectRepository(PaymentLink)
    private readonly repo: Repository<PaymentLink>,
    @InjectRepository(PaymentLinkEvent)
    private readonly eventRepo: Repository<PaymentLinkEvent>,
    appLogger: AppLogger,
  ) {
    this.logger = appLogger.child({ module: PaymentLinksService.name });
  }

  async create(dto: CreatePaymentLinkDto, merchantId: string): Promise<PaymentLink> {
    if (!dto.flexibleAmount && (dto.amount === undefined || dto.amount === null)) {
      throw new BadRequestException('amount is required when flexibleAmount is not true');
    }
    const token = randomBytes(16).toString('hex');
    const link = this.repo.create({
      ...dto,
      amount: dto.flexibleAmount ? null : dto.amount,
      flexibleAmount: dto.flexibleAmount ?? false,
      minAmount: dto.minAmount ?? null,
      token,
      merchantId,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
    });
    return this.repo.save(link);
  }

  async findByToken(token: string): Promise<PaymentLink> {
    const link = await this.repo.findOneBy({ token });
    if (!link) throw new NotFoundException('Payment link not found');
    if (!link.isActive) throw new GoneException('Payment link has been deactivated');
    if (link.expiresAt && link.expiresAt < new Date()) {
      throw new GoneException('Payment link has expired');
    }
    await this.repo.increment({ token }, 'views', 1);
    link.views += 1;
    return link;
  }

  async redeemLink(token: string, payerAmount?: number): Promise<PaymentLink> {
    const link = await this.findByToken(token);
    if (link.flexibleAmount) {
      if (payerAmount === undefined || payerAmount === null) {
        throw new BadRequestException('payerAmount is required for flexible-amount payment links');
      }
      if (link.minAmount !== null && payerAmount < Number(link.minAmount)) {
        throw new BadRequestException(
          `payerAmount must be at least ${link.minAmount}`,
        );
      }
    }
    return link;
  }

  async incrementCompletions(id: string): Promise<void> {
    await this.repo.increment({ id }, 'completions', 1);
  }

  async deactivate(id: string, merchantId: string): Promise<void> {
    const link = await this.repo.findOneBy({ id });
    if (!link) throw new NotFoundException('Payment link not found');
    if (link.merchantId !== merchantId) throw new ForbiddenException();
    link.isActive = false;
    await this.repo.save(link);
  }

  async findAllByMerchant(
    merchantId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<PaymentLink>> {
    const { page, limit, sortBy, order } = pagination;

    const allowedSortFields = ['createdAt', 'amount', 'views', 'completions', 'updatedAt'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    const [data, total] = await this.repo.findAndCount({
      where: { merchantId },
      order: { [sortField]: order || 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  async update(
    id: string,
    merchantId: string,
    dto: UpdatePaymentLinkDto,
  ): Promise<PaymentLink> {
    const link = await this.repo.findOneBy({ id });
    if (!link) throw new NotFoundException('Payment link not found');
    if (link.merchantId !== merchantId) throw new ForbiddenException();

    if (dto.amount !== undefined) link.amount = dto.amount;
    if (dto.currency !== undefined) link.currency = dto.currency;
    if (dto.description !== undefined) link.description = dto.description;
    if (dto.expiresAt !== undefined) {
      link.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    }

    return this.repo.save(link);
  }

  // ============ Analytics Methods ============

  /**
   * Record a view event with IP-based deduplication
   */
  async recordView(paymentLinkId: string, ip: string | undefined, userAgent?: string): Promise<void> {
    if (!ip) return;

    const ipHash = this.hashIp(ip);
    const windowStart = new Date(Date.now() - this.viewDebounceWindowMs);

    // Check for recent view from same IP
    const existingView = await this.eventRepo
      .createQueryBuilder('event')
      .where('event.paymentLinkId = :linkId', { linkId: paymentLinkId })
      .andWhere('event.type = :type', { type: PaymentLinkEventType.VIEW })
      .andWhere('event.ipHash = :ipHash', { ipHash })
      .andWhere('event.createdAt >= :windowStart', { windowStart })
      .getOne();

    if (existingView) {
      // Skip duplicate view within window
      return;
    }

    // Record the view event
    const event = this.eventRepo.create({
      paymentLinkId,
      type: PaymentLinkEventType.VIEW,
      ipHash,
      userAgent: userAgent || null,
    });
    await this.eventRepo.save(event);
  }

  /**
   * Record a redeem event
   */
  async recordRedeem(paymentLinkId: string, ip: string | undefined, userAgent?: string): Promise<void> {
    const event = this.eventRepo.create({
      paymentLinkId,
      type: PaymentLinkEventType.REDEEM,
      ipHash: ip ? this.hashIp(ip) : 'unknown',
      userAgent: userAgent || null,
    });
    await this.eventRepo.save(event);
  }

  /**
   * Record a completion event
   */
  async recordComplete(paymentLinkId: string, amount: number): Promise<void> {
    const event = this.eventRepo.create({
      paymentLinkId,
      type: PaymentLinkEventType.COMPLETE,
      ipHash: 'system',
      userAgent: null,
    });
    await this.eventRepo.save(event);
    
    // Also increment the counter on the payment link
    await this.incrementCompletions(paymentLinkId);
  }

  /**
   * Get analytics for a payment link
   */
  async getAnalytics(
    id: string,
    merchantId: string,
    dto: GetAnalyticsDto,
  ): Promise<{
    linkId: string;
    total: { views: number; redemptions: number; completions: number; conversionRate: number; revenue: number };
    buckets: AnalyticsBucketDto[];
  }> {
    // Verify ownership
    const link = await this.repo.findOneBy({ id });
    if (!link) throw new NotFoundException('Payment link not found');
    if (link.merchantId !== merchantId) throw new ForbiddenException();

    // Set date range defaults
    const to = dto.to ? new Date(dto.to) : new Date();
    const from = dto.from 
      ? new Date(dto.from) 
      : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000); // Default 30 days
    
    const interval = dto.interval || 'day';

    // Build bucket query
    const bucketFormat = interval === 'week' 
      ? "date_trunc('week', createdAt)" 
      : "date_trunc('day', createdAt)";

    // Get event counts by bucket
    const eventCounts = await this.eventRepo
      .createQueryBuilder('event')
      .select("date_trunc('day', event.createdAt)", 'date')
      .addSelect('event.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .where('event.paymentLinkId = :id', { id })
      .andWhere('event.createdAt >= :from', { from })
      .andWhere('event.createdAt <= :to', { to })
      .groupBy("date_trunc('day', event.createdAt)")
      .addGroupBy('event.type')
      .orderBy('date', 'ASC')
      .getRawMany();

    // Get total from payment link
    const totalViews = link.views;
    const totalRedemptions = eventCounts
      .filter(e => e.type === PaymentLinkEventType.REDEEM)
      .reduce((sum, e) => sum + parseInt(e.count), 0) || 0;
    const totalCompletions = link.completions;
    const conversionRate = totalViews > 0 ? totalCompletions / totalViews : 0;

    // For revenue, we use the payment link amount * completions
    const revenue = link.amount ? Number(link.amount) * 100 * totalCompletions : 0;

    // Build buckets
    const buckets = this.buildBuckets(from, to, interval, eventCounts);

    return {
      linkId: id,
      total: {
        views: totalViews,
        redemptions: totalRedemptions,
        completions: totalCompletions,
        conversionRate: Math.round(conversionRate * 100) / 100,
        revenue,
      },
      buckets,
    };
  }

  /**
   * Build analytics buckets from raw event data
   */
  private buildBuckets(
    from: Date,
    to: Date,
    interval: 'day' | 'week',
    eventCounts: Array<{ date: string; type: string; count: string }>,
  ): AnalyticsBucketDto[] {
    const buckets: AnalyticsBucketDto[] = [];
    const current = new Date(from);
    
    // Group events by date
    const eventsByDate = new Map<string, { VIEW: number; REDEEM: number; COMPLETE: number }>();
    for (const event of eventCounts) {
      const dateKey = event.date.split(' ')[0]; // Get just the date part
      if (!eventsByDate.has(dateKey)) {
        eventsByDate.set(dateKey, { VIEW: 0, REDEEM: 0, COMPLETE: 0 });
      }
      const counts = eventsByDate.get(dateKey)!;
      counts[event.type as keyof typeof counts] += parseInt(event.count);
    }

    while (current <= to) {
      const dateKey = current.toISOString().split('T')[0];
      const counts = eventsByDate.get(dateKey) || { VIEW: 0, REDEEM: 0, COMPLETE: 0 };
      
      const views = counts.VIEW;
      const redemptions = counts.REDEEM;
      const completions = counts.COMPLETE;
      const conversionRate = views > 0 ? completions / views : 0;

      buckets.push({
        date: dateKey,
        views,
        redemptions,
        completions,
        conversionRate: Math.round(conversionRate * 100) / 100,
        revenue: 0, // Per-bucket revenue requires payment data
      });

      // Advance to next interval
      if (interval === 'week') {
        current.setDate(current.getDate() + 7);
      } else {
        current.setDate(current.getDate() + 1);
      }
    }

    return buckets;
  }

  /**
   * Hash IP for deduplication
   */
  private hashIp(ip: string): string {
    return createHash('sha256').update(ip).digest('hex').substring(0, 64);
  }
}
