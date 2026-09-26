import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  RecurringPayment,
  RecurringPaymentInterval,
  RecurringPaymentStatus,
} from './recurring-payment.entity';
import { CreateRecurringPaymentDto } from './dto/create-recurring-payment.dto';
import { UpdateRecurringPaymentDto } from './dto/update-recurring-payment.dto';
import { PaymentsService } from './payments.service';
import { IdempotencyService } from './idempotency.service';
import { AppLogger } from '../logger/logger.service';
import { Logger } from 'pino';
import { WebhooksService } from '../webhooks/webhooks.service';
import { EmailNotificationService } from '../notifications/email-notification.service';
import { ConfigService } from '@nestjs/config';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import {
  RecurringPaymentCharge,
  RecurringPaymentChargeStatus,
} from './recurring-payment-charge.entity';

@Injectable()
export class RecurringPaymentsService {
  private readonly logger: Logger;
  private readonly autoPauseFailureThreshold: number;

  constructor(
    @InjectRepository(RecurringPayment)
    private readonly recurringPaymentRepository: Repository<RecurringPayment>,
    @InjectRepository(RecurringPaymentCharge)
    private readonly recurringPaymentChargeRepository: Repository<RecurringPaymentCharge>,
    private readonly paymentsService: PaymentsService,
    private readonly idempotencyService: IdempotencyService,
    private readonly webhooksService: WebhooksService,
    private readonly emailNotificationService: EmailNotificationService,
    private readonly configService: ConfigService,
    appLogger: AppLogger,
  ) {
    this.logger = appLogger.child({ module: RecurringPaymentsService.name });
    this.autoPauseFailureThreshold = Number(
      process.env.RECURRING_PAYMENT_AUTO_PAUSE_FAILURES ?? 3,
    );
  }

  async create(
    dto: CreateRecurringPaymentDto,
    createdBy: string,
  ): Promise<RecurringPayment> {
    if (dto.endAt && new Date(dto.endAt).getTime() <= Date.now()) {
      throw new BadRequestException('endAt must be in the future');
    }

    const trialDays = dto.trialDays ?? 0;
    const trialStartAt = dto.startAt ? new Date(dto.startAt) : new Date();
    const trialEndsAt =
      trialDays > 0
        ? new Date(trialStartAt.getTime() + trialDays * 24 * 60 * 60 * 1000)
        : null;
    const nextRunAt = trialEndsAt ?? trialStartAt;
    const plan = this.recurringPaymentRepository.create({
      amount: dto.amount,
      currency: dto.currency,
      interval: dto.interval,
      description: dto.description ?? null,
      merchantId: dto.merchantId ?? null,
      merchantEmail: dto.merchantEmail ?? null,
      payerEmail: dto.payerEmail ?? null,
      callbackUrl: dto.callbackUrl ?? null,
      metadata: dto.metadata ?? null,
      createdBy,
      status: trialEndsAt
        ? RecurringPaymentStatus.TRIALING
        : RecurringPaymentStatus.ACTIVE,
      endAt: dto.endAt ? new Date(dto.endAt) : null,
      maxOccurrences: dto.maxOccurrences ?? null,
      notifyDaysBefore: dto.notifyDaysBefore ?? 3,
      consecutiveFailures: 0,
      occurrences: 0,
      lastNotifiedCycle: null,
      trialDays,
      trialEndsAt,
      trialEndingNotifiedAt: null,
      nextRunAt,
    });

    return this.recurringPaymentRepository.save(plan);
  }

  async findAll(createdBy: string): Promise<RecurringPayment[]> {
    return this.recurringPaymentRepository.find({
      where: { createdBy },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, createdBy: string): Promise<RecurringPayment> {
    const plan = await this.recurringPaymentRepository.findOneBy({
      id,
      createdBy,
    });
    if (!plan) {
      throw new NotFoundException(`Recurring payment plan ${id} not found`);
    }
    return plan;
  }

  async findCharges(
    id: string,
    createdBy: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<RecurringPaymentCharge>> {
    const plan = await this.findOne(id, createdBy);
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const [data, total] = await this.recurringPaymentChargeRepository
      .createQueryBuilder('charge')
      .where('charge.recurringPaymentId = :recurringPaymentId', {
        recurringPaymentId: plan.id,
      })
      .orderBy('charge.attemptedAt', 'ASC')
      .addOrderBy('charge.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async update(
    id: string,
    createdBy: string,
    dto: UpdateRecurringPaymentDto,
  ): Promise<RecurringPayment> {
    const plan = await this.findOne(id, createdBy);

    if (dto.amount !== undefined) plan.amount = dto.amount;
    if (dto.interval !== undefined) plan.interval = dto.interval;
    if (dto.description !== undefined) plan.description = dto.description;

    return this.recurringPaymentRepository.save(plan);
  }

  async pause(id: string, createdBy: string): Promise<RecurringPayment> {
    const plan = await this.findOne(id, createdBy);
    if (plan.status !== RecurringPaymentStatus.ACTIVE) {
      throw new ConflictException(
        `Cannot pause a plan with status ${plan.status}`,
      );
    }
    plan.status = RecurringPaymentStatus.PAUSED;
    return this.recurringPaymentRepository.save(plan);
  }

  async resume(id: string, createdBy: string): Promise<RecurringPayment> {
    const plan = await this.findOne(id, createdBy);
    if (plan.status !== RecurringPaymentStatus.PAUSED) {
      throw new ConflictException(
        `Cannot resume a plan with status ${plan.status}`,
      );
    }
    plan.status = RecurringPaymentStatus.ACTIVE;
    if (plan.nextRunAt.getTime() < Date.now()) {
      plan.nextRunAt = new Date();
    }
    return this.recurringPaymentRepository.save(plan);
  }

  async cancel(id: string, createdBy: string): Promise<RecurringPayment> {
    const plan = await this.findOne(id, createdBy);
    if (plan.status === RecurringPaymentStatus.CANCELLED) {
      throw new ConflictException('Plan is already cancelled');
    }
    plan.status = RecurringPaymentStatus.CANCELLED;
    plan.cancelledAt = new Date();
    return this.recurringPaymentRepository.save(plan);
  }

  private computeNextRunAt(
    interval: RecurringPaymentInterval,
    from: Date,
  ): Date {
    const next = new Date(from);
    switch (interval) {
      case RecurringPaymentInterval.DAILY:
        next.setDate(next.getDate() + 1);
        break;
      case RecurringPaymentInterval.WEEKLY:
        next.setDate(next.getDate() + 7);
        break;
      case RecurringPaymentInterval.MONTHLY:
        next.setMonth(next.getMonth() + 1);
        break;
    }
    return next;
  }

  /**
   * Executes due recurring plans, creating a normal payment for each one via
   * the existing PaymentsService (reusing its fee/split/webhook lifecycle).
   * Guarded by an idempotency key per scheduled run to avoid double-charging
   * if the sweep overlaps or is retried.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processDuePlans(): Promise<void> {
    const duePlans = await this.recurringPaymentRepository.find({
      where: [
        {
          status: RecurringPaymentStatus.ACTIVE,
          nextRunAt: LessThanOrEqual(new Date()),
        },
        {
          status: RecurringPaymentStatus.TRIALING,
          nextRunAt: LessThanOrEqual(new Date()),
        },
      ],
    });

    for (const plan of duePlans) {
      await this.executePlan(plan);
    }
  }

  private async executePlan(plan: RecurringPayment): Promise<void> {
    const scheduledFor = plan.nextRunAt;
    const idempotencyKey = `recurring-payment:${plan.id}:${scheduledFor.toISOString()}`;
    let chargeAttempt: RecurringPaymentCharge | null = null;

    try {
      if (plan.status === RecurringPaymentStatus.TRIALING) {
        plan.status = RecurringPaymentStatus.ACTIVE;
      }

      chargeAttempt = await this.recurringPaymentChargeRepository.save(
        this.recurringPaymentChargeRepository.create({
          recurringPaymentId: plan.id,
          cycleNumber: (plan.occurrences ?? 0) + 1,
          paymentId: null,
          amount: plan.amount,
          status: RecurringPaymentChargeStatus.PENDING,
          failureReason: null,
        }),
      );

      const requestBody = {
        planId: plan.id,
        scheduledFor: scheduledFor.toISOString(),
      };
      const existing = await this.idempotencyService.checkKey(
        idempotencyKey,
        requestBody,
      );

      let paymentId: string;
      if (!existing) {
        const payment = await this.paymentsService.create({
          amount: plan.amount,
          currency: plan.currency,
          description: plan.description ?? undefined,
          merchantId: plan.merchantId ?? undefined,
          merchantEmail: plan.merchantEmail ?? undefined,
          payerEmail: plan.payerEmail ?? undefined,
          callbackUrl: plan.callbackUrl ?? undefined,
          metadata: plan.metadata ?? undefined,
        }, plan.id);
        paymentId = payment.id;
      } else {
        paymentId = existing.paymentId;
      }

      chargeAttempt.paymentId = paymentId;
      chargeAttempt.status = RecurringPaymentChargeStatus.SUCCEEDED;
      await this.recurringPaymentChargeRepository.save(chargeAttempt);

      if (!existing) {
        await this.idempotencyService.storeKey(idempotencyKey, requestBody, {
          paymentId,
        });
        this.logger.info(
          { planId: plan.id, paymentId },
          'Recurring payment charge created',
        );
      }

      plan.lastRunAt = scheduledFor;
      plan.occurrences = (plan.occurrences ?? 0) + 1;
      const nextRunAt = this.computeNextRunAt(plan.interval, scheduledFor);

      if (plan.maxOccurrences !== null && plan.occurrences >= plan.maxOccurrences) {
        plan.status = RecurringPaymentStatus.CANCELLED;
        plan.cancelledAt = new Date();
        plan.nextRunAt = nextRunAt;
        await this.recurringPaymentRepository.save(plan);
        return;
      }

      if (plan.endAt && nextRunAt.getTime() > plan.endAt.getTime()) {
        plan.status = RecurringPaymentStatus.CANCELLED;
        plan.cancelledAt = new Date();
        plan.nextRunAt = nextRunAt;
        await this.recurringPaymentRepository.save(plan);
        return;
      }

      plan.nextRunAt = nextRunAt;
      plan.consecutiveFailures = 0;
      await this.recurringPaymentRepository.save(plan);
    } catch (error) {
      const consecutiveFailures = (plan.consecutiveFailures ?? 0) + 1;
      plan.consecutiveFailures = consecutiveFailures;

      if (
        chargeAttempt &&
        chargeAttempt.status === RecurringPaymentChargeStatus.PENDING
      ) {
        chargeAttempt.status = RecurringPaymentChargeStatus.FAILED;
        chargeAttempt.failureReason = (
          error instanceof Error ? error.message : String(error)
        ).slice(0, 4000);
        await this.recurringPaymentChargeRepository.save(chargeAttempt);
      }

      this.logger.error(
        {
          planId: plan.id,
          consecutiveFailures,
          error: error instanceof Error ? error.message : error,
        },
        'Recurring payment charge failed',
      );

      if (consecutiveFailures >= this.autoPauseFailureThreshold) {
        plan.status = RecurringPaymentStatus.PAUSED;
        this.logger.warn(
          {
            planId: plan.id,
            consecutiveFailures,
            threshold: this.autoPauseFailureThreshold,
          },
          'Recurring payment plan auto-paused after repeated failures',
        );
        await this.notifyPlanPaused(plan);
      }

      await this.recurringPaymentRepository.save(plan);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async notifyTrialEnding(): Promise<void> {
    const plans = await this.recurringPaymentRepository.find({
      where: { status: RecurringPaymentStatus.TRIALING },
    });
    const now = new Date();
    const notificationDeadline = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    for (const plan of plans) {
      if (
        !plan.merchantId ||
        !plan.trialEndsAt ||
        plan.trialEndingNotifiedAt ||
        plan.trialEndsAt.getTime() <= now.getTime() ||
        plan.trialEndsAt.getTime() > notificationDeadline.getTime()
      ) {
        continue;
      }

      await this.webhooksService.dispatchEventToMerchant(
        plan.merchantId,
        'recurring.trial_ending',
        {
          planId: plan.id,
          trialEndsAt: plan.trialEndsAt,
        },
      );
      plan.trialEndingNotifiedAt = now;
      await this.recurringPaymentRepository.save(plan);
    }
  }

  private async notifyPayer(plan: RecurringPayment): Promise<void> {
    if (!plan.payerEmail || plan.notifyDaysBefore === 0 || !plan.merchantEmail) {
      return;
    }

    const appUrl = this.configService.get<string>('APP_URL', 'http://localhost:3000');
    const manageUrl = `${appUrl}/recurring/${plan.id}`;
    const cancelUrl = `${appUrl}/recurring/${plan.id}/cancel`;

    await this.emailNotificationService.sendPayerRecurringPaymentReminder(
      plan.payerEmail,
      null,
      plan.id,
      String(plan.amount),
      plan.currency,
      plan.nextRunAt,
      plan.merchantEmail,
      manageUrl,
      cancelUrl,
      plan.description,
    );
  }

  /**
   * Cron job to notify payers before upcoming recurring charges.
   * Runs daily to find plans whose next charge is within the notification window.
   * Sends at most one notification per cycle (tracked by lastNotifiedCycle).
   */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async notifyUpcomingCharges(): Promise<void> {
    const plans = await this.recurringPaymentRepository.find({
      where: {
        status: RecurringPaymentStatus.ACTIVE,
        notifyDaysBefore: MoreThanOrEqual(1),
      },
    });

    const now = new Date();
    const notifiedCycleNumbers = new Set<string>(); // track already-notified plans

    for (const plan of plans) {
      const cycleNumber = this.getCycleNumber(plan);
      const key = `${plan.id}:${cycleNumber}`;

      // Skip if already notified for this cycle
      if (plan.lastNotifiedCycle === cycleNumber || notifiedCycleNumbers.has(key)) {
        continue;
      }

      const daysUntilCharge = this.getDaysUntilCharge(plan.nextRunAt, now);

      if (daysUntilCharge <= plan.notifyDaysBefore && daysUntilCharge >= 0) {
        await this.notifyPayer(plan);
        plan.lastNotifiedCycle = cycleNumber;
        await this.recurringPaymentRepository.save(plan);
        notifiedCycleNumbers.add(key);
      }
    }
  }

  private getCycleNumber(plan: RecurringPayment): number {
    return plan.occurrences + 1;
  }

  private getDaysUntilCharge(nextRunAt: Date, from: Date): number {
    const diff = nextRunAt.getTime() - from.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }
}
