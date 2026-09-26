import { ConflictException, NotFoundException } from '@nestjs/common';
import { RecurringPaymentsService } from './recurring-payments.service';
import {
  RecurringPaymentInterval,
  RecurringPaymentStatus,
} from './recurring-payment.entity';
import {
  RecurringPaymentChargeStatus,
} from './recurring-payment-charge.entity';

describe('RecurringPaymentsService', () => {
  let service: RecurringPaymentsService;
  let mockRepository: any;
  let mockChargeRepository: any;
  let mockPaymentsService: any;
  let mockIdempotencyService: any;
  let mockWebhooksService: any;
  let mockAppLogger: any;

  beforeEach(() => {
    mockRepository = {
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn((entity) => Promise.resolve(entity)),
      find: jest.fn(),
      findOneBy: jest.fn(),
    };

    mockChargeRepository = {
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn((entity) => Promise.resolve(entity)),
      createQueryBuilder: jest.fn(),
    };

    mockPaymentsService = {
      create: jest.fn().mockResolvedValue({ id: 'payment-1' }),
    };

    mockIdempotencyService = {
      checkKey: jest.fn().mockResolvedValue(null),
      storeKey: jest.fn().mockResolvedValue(undefined),
    };

    mockWebhooksService = {
      dispatchEventToMerchant: jest.fn().mockResolvedValue(undefined),
    };

    mockAppLogger = {
      child: jest.fn().mockReturnValue({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }),
    };

    service = new RecurringPaymentsService(
      mockRepository,
      mockChargeRepository,
      mockPaymentsService,
      mockIdempotencyService,
      mockWebhooksService,
      { sendPayerRecurringPaymentReminder: jest.fn() } as any,
      { get: jest.fn((_key, defaultValue) => defaultValue) } as any,
      mockAppLogger,
    );
  });

  describe('create', () => {
    it('creates an active plan owned by the requesting user', async () => {
      const plan = await service.create(
        {
          amount: 29.99,
          currency: 'USD',
          interval: RecurringPaymentInterval.MONTHLY,
        },
        'user-1',
      );

      expect(plan.createdBy).toBe('user-1');
      expect(plan.status).toBe(RecurringPaymentStatus.ACTIVE);
      expect(plan.nextRunAt).toBeInstanceOf(Date);
    });

    it('schedules the first run at startAt when provided', async () => {
      const startAt = '2026-08-01T00:00:00.000Z';
      const plan = await service.create(
        {
          amount: 10,
          currency: 'USD',
          interval: RecurringPaymentInterval.WEEKLY,
          startAt,
        },
        'user-1',
      );

      expect(plan.nextRunAt.toISOString()).toBe(startAt);
    });

    it('starts a trialing plan and schedules its first charge at trialEndsAt', async () => {
      const startAt = new Date(Date.now() + 1000);
      const plan = await service.create(
        {
          amount: 10,
          currency: 'USD',
          interval: RecurringPaymentInterval.MONTHLY,
          startAt: startAt.toISOString(),
          trialDays: 14,
        },
        'user-1',
      );

      expect(plan.status).toBe(RecurringPaymentStatus.TRIALING);
      expect(plan.trialDays).toBe(14);
      expect(plan.trialEndsAt).toEqual(
        new Date(startAt.getTime() + 14 * 24 * 60 * 60 * 1000),
      );
      expect(plan.nextRunAt).toEqual(plan.trialEndsAt);
    });
  });

  describe('pause / resume / cancel', () => {
    it('pauses an active plan', async () => {
      mockRepository.findOneBy.mockResolvedValue({
        id: 'plan-1',
        createdBy: 'user-1',
        status: RecurringPaymentStatus.ACTIVE,
        nextRunAt: new Date(Date.now() + 10000),
      });

      const result = await service.pause('plan-1', 'user-1');
      expect(result.status).toBe(RecurringPaymentStatus.PAUSED);
    });

    it('throws when pausing a non-active plan', async () => {
      mockRepository.findOneBy.mockResolvedValue({
        id: 'plan-1',
        createdBy: 'user-1',
        status: RecurringPaymentStatus.CANCELLED,
      });

      await expect(service.pause('plan-1', 'user-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('resumes a paused plan', async () => {
      mockRepository.findOneBy.mockResolvedValue({
        id: 'plan-1',
        createdBy: 'user-1',
        status: RecurringPaymentStatus.PAUSED,
        nextRunAt: new Date(Date.now() - 10000),
      });

      const result = await service.resume('plan-1', 'user-1');
      expect(result.status).toBe(RecurringPaymentStatus.ACTIVE);
    });

    it('throws when resuming a non-paused plan', async () => {
      mockRepository.findOneBy.mockResolvedValue({
        id: 'plan-1',
        createdBy: 'user-1',
        status: RecurringPaymentStatus.ACTIVE,
      });

      await expect(service.resume('plan-1', 'user-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('cancels an active plan', async () => {
      mockRepository.findOneBy.mockResolvedValue({
        id: 'plan-1',
        createdBy: 'user-1',
        status: RecurringPaymentStatus.ACTIVE,
      });

      const result = await service.cancel('plan-1', 'user-1');
      expect(result.status).toBe(RecurringPaymentStatus.CANCELLED);
      expect(result.cancelledAt).toBeInstanceOf(Date);
    });

    it('cancels a trialing plan without allowing a charge in the due sweep', async () => {
      const plan = {
        id: 'trial-plan',
        createdBy: 'user-1',
        status: RecurringPaymentStatus.TRIALING,
        trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };
      mockRepository.findOneBy.mockResolvedValue(plan);

      const cancelled = await service.cancel('trial-plan', 'user-1');
      mockRepository.find.mockResolvedValue([]);
      await service.processDuePlans();

      expect(cancelled.status).toBe(RecurringPaymentStatus.CANCELLED);
      expect(cancelled.cancelledAt).toBeInstanceOf(Date);
      expect(mockPaymentsService.create).not.toHaveBeenCalled();
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: [
          expect.objectContaining({ status: RecurringPaymentStatus.ACTIVE }),
          expect.objectContaining({ status: RecurringPaymentStatus.TRIALING }),
        ],
      });
    });

    it('throws when cancelling an already-cancelled plan', async () => {
      mockRepository.findOneBy.mockResolvedValue({
        id: 'plan-1',
        createdBy: 'user-1',
        status: RecurringPaymentStatus.CANCELLED,
      });

      await expect(service.cancel('plan-1', 'user-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws NotFoundException for a plan the user does not own', async () => {
      mockRepository.findOneBy.mockResolvedValue(null);

      await expect(service.pause('missing', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('rejects endAt values in the past', async () => {
      await expect(
        service.create(
          {
            amount: 29.99,
            currency: 'USD',
            interval: RecurringPaymentInterval.MONTHLY,
            endAt: new Date(Date.now() - 1000).toISOString(),
          },
          'user-1',
        ),
      ).rejects.toThrow('endAt must be in the future');
    });
  });

  describe('processDuePlans', () => {
    it('creates a payment for each due plan and advances nextRunAt', async () => {
      const dueAt = new Date('2026-07-01T00:00:00.000Z');
      const plan = {
        id: 'plan-1',
        amount: 20,
        currency: 'USD',
        interval: RecurringPaymentInterval.DAILY,
        status: RecurringPaymentStatus.ACTIVE,
        nextRunAt: dueAt,
        description: null,
        merchantId: null,
        merchantEmail: null,
        payerEmail: null,
        callbackUrl: null,
        metadata: null,
      };
      mockRepository.find.mockResolvedValue([plan]);

      await service.processDuePlans();

      expect(mockPaymentsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 20, currency: 'USD' }),
        'plan-1',
      );
      expect(mockIdempotencyService.storeKey).toHaveBeenCalledWith(
        `recurring-payment:plan-1:${dueAt.toISOString()}`,
        expect.anything(),
        { paymentId: 'payment-1' },
      );
      expect(plan.lastRunAt).toEqual(dueAt);
      expect(plan.nextRunAt.getTime()).toBe(dueAt.getTime() + 24 * 60 * 60 * 1000);
      expect(mockChargeRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          recurringPaymentId: 'plan-1',
          cycleNumber: 1,
          paymentId: 'payment-1',
          status: RecurringPaymentChargeStatus.SUCCEEDED,
        }),
      );
    });

    it('records a failed charge attempt and its failure reason', async () => {
      const dueAt = new Date('2026-07-01T00:00:00.000Z');
      const plan = {
        id: 'plan-1',
        amount: 20,
        currency: 'USD',
        interval: RecurringPaymentInterval.DAILY,
        status: RecurringPaymentStatus.ACTIVE,
        nextRunAt: dueAt,
        occurrences: 2,
        consecutiveFailures: 0,
      };
      mockRepository.find.mockResolvedValue([plan]);
      mockPaymentsService.create.mockRejectedValueOnce(
        new Error('payment gateway declined'),
      );

      await service.processDuePlans();

      expect(mockChargeRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recurringPaymentId: 'plan-1',
          cycleNumber: 3,
          amount: 20,
          status: RecurringPaymentChargeStatus.PENDING,
        }),
      );
      expect(mockChargeRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          cycleNumber: 3,
          paymentId: null,
          status: RecurringPaymentChargeStatus.FAILED,
          failureReason: 'payment gateway declined',
        }),
      );
    });

    it('transitions a due trial to active before creating the first charge', async () => {
      const trialEndsAt = new Date(Date.now() - 1000);
      const plan = {
        id: 'trial-plan',
        amount: 20,
        currency: 'USD',
        interval: RecurringPaymentInterval.DAILY,
        status: RecurringPaymentStatus.TRIALING,
        nextRunAt: trialEndsAt,
        trialEndsAt,
        occurrences: 0,
        maxOccurrences: null,
        endAt: null,
        consecutiveFailures: 0,
      };
      mockRepository.find.mockResolvedValue([plan]);

      await service.processDuePlans();

      expect(mockPaymentsService.create).toHaveBeenCalledTimes(1);
      expect(plan.status).toBe(RecurringPaymentStatus.ACTIVE);
      expect(plan.lastRunAt).toEqual(trialEndsAt);
    });

    it('skips creating a duplicate payment when the run was already processed', async () => {
      const dueAt = new Date('2026-07-01T00:00:00.000Z');
      const plan = {
        id: 'plan-1',
        amount: 20,
        currency: 'USD',
        interval: RecurringPaymentInterval.DAILY,
        status: RecurringPaymentStatus.ACTIVE,
        nextRunAt: dueAt,
      };
      mockRepository.find.mockResolvedValue([plan]);
      mockIdempotencyService.checkKey.mockResolvedValue({ paymentId: 'existing-payment' });

      await service.processDuePlans();

      expect(mockPaymentsService.create).not.toHaveBeenCalled();
      expect(plan.lastRunAt).toEqual(dueAt);
    });

    it('auto-pauses the plan after the configured number of consecutive failures', async () => {
      const dueAt = new Date('2026-07-01T00:00:00.000Z');
      const plan = {
        id: 'plan-1',
        amount: 20,
        currency: 'USD',
        interval: RecurringPaymentInterval.DAILY,
        status: RecurringPaymentStatus.ACTIVE,
        nextRunAt: dueAt,
        consecutiveFailures: 2,
      };
      mockRepository.find.mockResolvedValue([plan]);
      mockPaymentsService.create.mockRejectedValue(new Error('boom'));

      await service.processDuePlans();

      expect(plan.consecutiveFailures).toBe(3);
      expect(plan.status).toBe(RecurringPaymentStatus.PAUSED);
      expect(mockPaymentsService.create).toHaveBeenCalledTimes(1);
      expect(mockRepository.save).toHaveBeenCalledWith(plan);
    });

    it('auto-cancels a plan when maxOccurrences is reached and does not process a 13th charge', async () => {
      const dueAt = new Date('2026-07-01T00:00:00.000Z');
      const plan = {
        id: 'plan-1',
        amount: 20,
        currency: 'USD',
        interval: RecurringPaymentInterval.DAILY,
        status: RecurringPaymentStatus.ACTIVE,
        nextRunAt: dueAt,
        occurrences: 12,
        maxOccurrences: 12,
      };
      mockRepository.find.mockResolvedValue([plan]);

      await service.processDuePlans();

      expect(plan.occurrences).toBe(13);
      expect(plan.status).toBe(RecurringPaymentStatus.CANCELLED);
      expect(mockPaymentsService.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('notifyTrialEnding', () => {
    it('dispatches the trial-ending event once within three days of trial end', async () => {
      const plan = {
        id: 'trial-plan',
        merchantId: 'merchant-1',
        status: RecurringPaymentStatus.TRIALING,
        trialEndsAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        trialEndingNotifiedAt: null,
      };
      mockRepository.find.mockResolvedValue([plan]);

      await service.notifyTrialEnding();

      expect(mockWebhooksService.dispatchEventToMerchant).toHaveBeenCalledWith(
        'merchant-1',
        'recurring.trial_ending',
        { planId: 'trial-plan', trialEndsAt: plan.trialEndsAt },
      );
      expect(plan.trialEndingNotifiedAt).toBeInstanceOf(Date);
      expect(mockRepository.save).toHaveBeenCalledWith(plan);
    });
  });

  describe('findCharges', () => {
    it('returns charge history in chronological order with pagination', async () => {
      const charges = [{ id: 'charge-1', cycleNumber: 1 }];
      const query: any = {};
      query.where = jest.fn().mockReturnValue(query);
      query.orderBy = jest.fn().mockReturnValue(query);
      query.addOrderBy = jest.fn().mockReturnValue(query);
      query.skip = jest.fn().mockReturnValue(query);
      query.take = jest.fn().mockReturnValue(query);
      query.getManyAndCount = jest.fn().mockResolvedValue([charges, 3]);
      mockChargeRepository.createQueryBuilder.mockReturnValue(query);
      mockRepository.findOneBy.mockResolvedValue({
        id: 'plan-1',
        createdBy: 'user-1',
      });

      const result = await service.findCharges('plan-1', 'user-1', {
        page: 2,
        limit: 1,
      });

      expect(result).toEqual({ data: charges, total: 3, page: 2, limit: 1 });
      expect(query.where).toHaveBeenCalledWith(
        'charge.recurringPaymentId = :recurringPaymentId',
        { recurringPaymentId: 'plan-1' },
      );
      expect(query.orderBy).toHaveBeenCalledWith('charge.attemptedAt', 'ASC');
      expect(query.skip).toHaveBeenCalledWith(1);
      expect(query.take).toHaveBeenCalledWith(1);
    });

    it('does not query charge history for a plan the caller does not own', async () => {
      mockRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.findCharges('plan-1', 'other-user', {}),
      ).rejects.toThrow(NotFoundException);
      expect(mockChargeRepository.createQueryBuilder).not.toHaveBeenCalled();
    });
  });
});
