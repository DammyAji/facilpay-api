import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, DataSource } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { Settlement } from './entities/settlement.entity';
import { SettlementAdjustment } from './entities/settlement-adjustment.entity';
import {
  MerchantSettlementConfig,
  SettlementSchedule,
} from './entities/merchant-settlement-config.entity';
import { UpsertSettlementConfigDto } from './dto/upsert-settlement-config.dto';
import { GetSettlementsDto } from './dto/get-settlements.dto';
import { Payment, PaymentStatus } from '../payments/payment.entity';
import { MailService } from '../auth/mail/mail.service';
import { UsersService } from '../users/users.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import {
  PaginatedResult,
} from '../../common/interfaces/paginated-result.interface';
import { EventsService } from '../events/events.service';
import { SettlementStatus } from './entities/settlement.entity';

@Injectable()
export class SettlementsService {
  private readonly logger = new Logger(SettlementsService.name);
  private readonly settleOnGross: boolean;

  constructor(
    @InjectRepository(Settlement)
    private readonly settlementRepo: Repository<Settlement>,
    @InjectRepository(SettlementAdjustment)
    private readonly settlementAdjustmentRepo: Repository<SettlementAdjustment>,
    @InjectRepository(MerchantSettlementConfig)
    private readonly configRepo: Repository<MerchantSettlementConfig>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    private readonly dataSource: DataSource,
    private readonly mailService: MailService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly webhooksService: WebhooksService,
    private readonly eventsService: EventsService,
  ) {
    this.settleOnGross =
      String(
        this.configService.get<string | boolean>(
          'SETTLEMENT_USE_GROSS_AMOUNT',
          'false',
        ),
      ).toLowerCase() === 'true';
  }

  async upsertConfig(userId: string, dto: UpsertSettlementConfigDto): Promise<MerchantSettlementConfig> {
    let config = await this.configRepo.findOneBy({ userId, currency: dto.currency });
    if (!config) {
      config = this.configRepo.create({ userId, ...dto });
    } else {
      config.schedule = dto.schedule;
    }
    return this.configRepo.save(config);
  }

  async findMerchantSettlements(
    merchantId: string,
    dto?: GetSettlementsDto,
  ): Promise<PaginatedResult<Settlement>> {
    const query = this.settlementRepo.createQueryBuilder('settlement');

    query.where('settlement.merchantId = :merchantId', { merchantId });

    if (dto?.from) {
      query.andWhere('settlement.processedAt >= :fromDate', { fromDate: dto.from });
    }
    if (dto?.to) {
      query.andWhere('settlement.processedAt <= :toDate', { toDate: dto.to });
    }

    const page = dto?.page || 1;
    const limit = dto?.limit || 20;
    const skip = (page - 1) * limit;

    query.orderBy('settlement.processedAt', 'DESC');
    query.skip(skip).take(limit);

    const [data, total] = await query.getManyAndCount();

    return { data, total, page, limit };
  }

  async findAllSettlements(
    dto?: GetSettlementsDto,
  ): Promise<PaginatedResult<Settlement>> {
    const query = this.settlementRepo.createQueryBuilder('settlement');

    if (dto?.merchantId) {
      query.where('settlement.merchantId = :merchantId', { merchantId: dto.merchantId });
    }

    if (dto?.from) {
      query.andWhere('settlement.processedAt >= :fromDate', { fromDate: dto.from });
    }
    if (dto?.to) {
      query.andWhere('settlement.processedAt <= :toDate', { toDate: dto.to });
    }

    const page = dto?.page || 1;
    const limit = dto?.limit || 20;
    const skip = (page - 1) * limit;

    query.orderBy('settlement.processedAt', 'DESC');
    query.skip(skip).take(limit);

    const [data, total] = await query.getManyAndCount();

    return { data, total, page, limit };
  }

  async findAdjustmentsForSettlement(
    merchantId: string,
    settlementId: string,
  ): Promise<SettlementAdjustment[]> {
    const settlement = await this.settlementRepo.findOneBy({
      id: settlementId,
      merchantId,
    });
    if (!settlement) {
      throw new NotFoundException(`Settlement ${settlementId} not found`);
    }

    return this.settlementAdjustmentRepo.find({
      where: { settlementId },
      order: { createdAt: 'DESC' },
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async runDailySettlements(): Promise<void> {
    await this.processSettlementsForSchedule(SettlementSchedule.DAILY);
  }

  @Cron('0 0 * * 0')
  async runWeeklySettlements(): Promise<void> {
    await this.processSettlementsForSchedule(SettlementSchedule.WEEKLY);
  }

  @Cron('0 0 1 * *')
  async runMonthlySettlements(): Promise<void> {
    await this.processSettlementsForSchedule(SettlementSchedule.MONTHLY);
  }

  private async processSettlementsForSchedule(schedule: SettlementSchedule): Promise<void> {
    const configs = await this.configRepo.find({ where: { schedule } });

    for (const config of configs) {
      try {
        await this.processMerchantSettlement(config);
      } catch (error) {
        this.logger.error(
          `Settlement processing failed for merchant ${config.userId}`,
          error instanceof Error ? error.stack : error,
        );
      }
    }
  }

  async triggerManualRun(merchantId?: string): Promise<{
    settlementsCreated: number;
    totalAmount: number;
    settlements: Settlement[];
  }> {
    let configs: MerchantSettlementConfig[];

    if (merchantId) {
      // If merchantId is provided, process only that merchant's configs
      configs = await this.configRepo.find({ where: { userId: merchantId } });
    } else {
      // Otherwise, process all configs
      configs = await this.configRepo.find();
    }

    const settlements: Settlement[] = [];

    for (const config of configs) {
      try {
        const settlement = await this.processMerchantSettlement(config);
        if (settlement) settlements.push(settlement);
      } catch (error) {
        this.logger.error(
          `Settlement processing failed for merchant ${config.userId}`,
          error instanceof Error ? error.stack : error,
        );
      }
    }

    const totalAmount = settlements.reduce(
      (sum, s) => sum + Number(s.totalAmount),
      0,
    );

    return {
      settlementsCreated: settlements.length,
      totalAmount,
      settlements,
    };
  }

  private async processMerchantSettlement(
    config: MerchantSettlementConfig,
  ): Promise<Settlement | null> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Acquire exclusive row lock on the config row to prevent concurrent settlement runs
      const lockedConfig = await queryRunner.manager
        .createQueryBuilder(MerchantSettlementConfig, 'config')
        .setLock('pessimistic_write')
        .where('config.id = :id', { id: config.id })
        .getOne();

      if (!lockedConfig) {
        await queryRunner.rollbackTransaction();
        return null;
      }

      // Use the fresh config value with the lock acquired
      const since = lockedConfig.lastSettledAt ?? new Date(0);

      const completedPayments = await queryRunner.manager
        .createQueryBuilder(Payment, 'p')
        .where('p.status = :status', { status: PaymentStatus.COMPLETED })
        .andWhere('p.merchantId = :merchantId', { merchantId: lockedConfig.userId })
        .andWhere('p.currency = :currency', { currency: lockedConfig.currency })
        .andWhere('p.updatedAt > :since', { since })
        .getMany();

      if (completedPayments.length === 0) {
        await queryRunner.rollbackTransaction();
        return null;
      }

      const totalAmount = completedPayments.reduce(
        (sum, p) =>
          sum +
          Number(
            this.settleOnGross
              ? p.amount
              : p.netAmount !== undefined && p.netAmount !== null
                ? p.netAmount
                : p.amount,
          ),
        0,
      );

      const settlement = queryRunner.manager.create(Settlement, {
        merchantId: lockedConfig.userId,
        schedule: lockedConfig.schedule,
        totalAmount,
        currency: lockedConfig.currency,
        paymentIds: completedPayments.map((p) => p.id),
        processedAt: new Date(),
        status: SettlementStatus.PENDING,
      });

      const savedSettlement = await queryRunner.manager.save(settlement);

      await queryRunner.manager.update(
        Payment,
        { id: In(completedPayments.map((p) => p.id)) },
        { settlementId: savedSettlement.id },
      );

      lockedConfig.lastSettledAt = new Date();
      await queryRunner.manager.save(lockedConfig);

      // Mark settlement as completed
      savedSettlement.status = SettlementStatus.COMPLETED;
      await this.settlementRepo.save(savedSettlement);

      await queryRunner.commitTransaction();

      // Send webhook and persist event (outside transaction)
      await this.dispatchSettlementEvents(savedSettlement, completedPayments.length, null);

      // Send email outside the transaction (non-critical operation)
      await this.sendSettlementEmail(lockedConfig.userId, savedSettlement, totalAmount);

      return savedSettlement;
    } catch (error) {
      // Log failed settlement
      const userId = config.userId;
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Create a failed settlement record if possible
      try {
        const failedSettlement = this.settlementRepo.create({
          merchantId: userId,
          schedule: config.schedule,
          totalAmount: 0,
          currency: config.currency,
          paymentIds: [],
          processedAt: new Date(),
          status: SettlementStatus.FAILED,
          failureReason: errorMessage,
        });
        const savedFailed = await this.settlementRepo.save(failedSettlement);
        await this.dispatchSettlementEvents(savedFailed, 0, errorMessage);
      } catch {
        // Ignore - we're already in an error state
      }

      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async dispatchSettlementEvents(
    settlement: Settlement,
    paymentCount: number,
    failureReason: string | null,
  ): Promise<void> {
    const payload = {
      settlementId: settlement.id,
      amount: String(settlement.totalAmount),
      currency: settlement.currency,
      paymentCount,
      stellarTransactionHash: settlement.stellarTransactionHash,
      failureReason,
    };

    // Persist domain event
    this.eventsService.emit(settlement.merchantId, 'settlement.created', payload);

    if (settlement.status === SettlementStatus.COMPLETED) {
      this.eventsService.emit(settlement.merchantId, 'settlement.completed', payload);
    } else if (settlement.status === SettlementStatus.FAILED) {
      this.eventsService.emit(settlement.merchantId, 'settlement.failed', payload);
    }

    // Dispatch webhook
    const event = settlement.status === SettlementStatus.COMPLETED
      ? 'settlement.completed'
      : settlement.status === SettlementStatus.FAILED
        ? 'settlement.failed'
        : 'settlement.created';

    await this.webhooksService.dispatchEventToMerchant(settlement.merchantId, event, payload);
  }

  private async sendSettlementEmail(
    userId: string,
    settlement: Settlement,
    totalAmount: number,
  ): Promise<void> {
    try {
      const user = await this.usersService.findOne(userId);
      if (!user?.email) return;

      await this.mailService.sendSettlementNotification(
        user.email,
        settlement,
        totalAmount,
      );
    } catch {
      // non-critical — settlement is already persisted
    }
  }
}
