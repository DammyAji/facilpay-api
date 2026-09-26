import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ReportsService, ReportSummary } from './reports.service';
import {
  ReportSubscription,
  ReportFrequency,
} from './entities/report-subscription.entity';
import { Payment, PaymentStatus } from '../payments/payment.entity';
import { Refund } from '../payments/refund.entity';
import { EmailNotificationService } from '../notifications/email-notification.service';
import { AppLogger } from '../logger/logger.service';

const mockRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  remove: jest.fn(),
});

const mockEmailService = { sendMerchantReport: jest.fn() };
const mockLogger = {
  child: () => ({ info: jest.fn(), error: jest.fn(), debug: jest.fn() }),
};

describe('ReportsService', () => {
  let service: ReportsService;
  let subscriptionRepo: ReturnType<typeof mockRepo>;
  let paymentRepo: ReturnType<typeof mockRepo>;
  let refundRepo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: getRepositoryToken(ReportSubscription), useFactory: mockRepo },
        { provide: getRepositoryToken(Payment), useFactory: mockRepo },
        { provide: getRepositoryToken(Refund), useFactory: mockRepo },
        { provide: EmailNotificationService, useValue: mockEmailService },
        { provide: AppLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get(ReportsService);
    subscriptionRepo = module.get(getRepositoryToken(ReportSubscription));
    paymentRepo = module.get(getRepositoryToken(Payment));
    refundRepo = module.get(getRepositoryToken(Refund));
  });

  // ─── getPeriodBounds ──────────────────────────────────────────────────────

  describe('getPeriodBounds', () => {
    const now = new Date('2026-09-26T14:30:00.000Z'); // Saturday 14:30 UTC

    it('DAILY returns yesterday window', () => {
      const { start, end } = service.getPeriodBounds(
        ReportFrequency.DAILY,
        'UTC',
        now,
      );
      expect(end.toISOString()).toBe('2026-09-26T00:00:00.000Z');
      expect(start.toISOString()).toBe('2026-09-25T00:00:00.000Z');
    });

    it('WEEKLY returns last 7 days', () => {
      const { start, end } = service.getPeriodBounds(
        ReportFrequency.WEEKLY,
        'UTC',
        now,
      );
      expect(end.toISOString()).toBe('2026-09-26T00:00:00.000Z');
      expect(start.toISOString()).toBe('2026-09-19T00:00:00.000Z');
    });

    it('MONTHLY returns last calendar month window', () => {
      const { start, end } = service.getPeriodBounds(
        ReportFrequency.MONTHLY,
        'UTC',
        now,
      );
      expect(end.toISOString()).toBe('2026-09-26T00:00:00.000Z');
      expect(start.getUTCMonth()).toBe(7); // August
    });

    it('respects timezone offset for period boundary', () => {
      // "America/New_York" is UTC-4 in September (EDT)
      // 14:30 UTC = 10:30 local → still Sep 26 locally → midnight local = Sep 26 04:00 UTC
      const { end } = service.getPeriodBounds(
        ReportFrequency.DAILY,
        'America/New_York',
        now,
      );
      // Local midnight on Sep 26 in EDT (UTC-4) = 04:00 UTC
      expect(end.toISOString()).toBe('2026-09-26T04:00:00.000Z');
    });
  });

  // ─── isDue ────────────────────────────────────────────────────────────────

  describe('isDue', () => {
    const now = new Date('2026-09-26T14:00:00.000Z');

    it('returns true when lastSentAt is null (never sent)', () => {
      const sub = { isActive: true, lastSentAt: null, frequency: ReportFrequency.DAILY, timezone: 'UTC' } as ReportSubscription;
      expect(service.isDue(sub, now)).toBe(true);
    });

    it('returns false when lastSentAt is within current period', () => {
      // Current DAILY period start = 2026-09-26T00:00:00Z
      const sub = {
        isActive: true,
        lastSentAt: new Date('2026-09-26T01:00:00.000Z'),
        frequency: ReportFrequency.DAILY,
        timezone: 'UTC',
      } as ReportSubscription;
      expect(service.isDue(sub, now)).toBe(false);
    });

    it('returns true when lastSentAt predates current period', () => {
      const sub = {
        isActive: true,
        lastSentAt: new Date('2026-09-24T12:00:00.000Z'),
        frequency: ReportFrequency.DAILY,
        timezone: 'UTC',
      } as ReportSubscription;
      expect(service.isDue(sub, now)).toBe(true);
    });

    it('returns false for inactive subscription', () => {
      const sub = {
        isActive: false,
        lastSentAt: null,
        frequency: ReportFrequency.DAILY,
        timezone: 'UTC',
      } as ReportSubscription;
      expect(service.isDue(sub, now)).toBe(false);
    });
  });

  // ─── buildSummary totals ──────────────────────────────────────────────────

  describe('buildSummary', () => {
    it('aggregates completed payment totals correctly', async () => {
      const payments: Partial<Payment>[] = [
        { status: PaymentStatus.COMPLETED, amount: 100, feeAmount: 3, netAmount: 97, currency: 'USD' },
        { status: PaymentStatus.COMPLETED, amount: 200, feeAmount: 6, netAmount: 194, currency: 'USD' },
        { status: PaymentStatus.PENDING, amount: 50, feeAmount: 0, netAmount: 50, currency: 'USD' },
      ] as unknown as Payment[];
      const refunds: Partial<Refund>[] = [
        { amount: 20 },
        { amount: 10 },
      ] as unknown as Refund[];

      paymentRepo.find.mockResolvedValue(payments);
      refundRepo.find.mockResolvedValue(refunds);

      const start = new Date('2026-09-25T00:00:00.000Z');
      const end = new Date('2026-09-26T00:00:00.000Z');
      const summary: ReportSummary = await service.buildSummary(
        'merchant-1',
        ReportFrequency.DAILY,
        start,
        end,
      );

      expect(summary.totalPayments).toBe(3);
      expect(summary.completedPayments).toBe(2);
      expect(summary.totalVolume).toBe(300);
      expect(summary.totalFees).toBe(9);
      expect(summary.totalNetAmount).toBe(291);
      expect(summary.totalRefunds).toBe(30);
      expect(summary.refundCount).toBe(2);
      expect(summary.currency).toBe('USD');
    });

    it('handles empty payment set gracefully', async () => {
      paymentRepo.find.mockResolvedValue([]);
      refundRepo.find.mockResolvedValue([]);

      const summary = await service.buildSummary(
        'merchant-2',
        ReportFrequency.WEEKLY,
        new Date(),
        new Date(),
      );

      expect(summary.totalPayments).toBe(0);
      expect(summary.totalVolume).toBe(0);
      expect(summary.currency).toBe('USD'); // fallback
    });
  });

  // ─── buildCsv ─────────────────────────────────────────────────────────────

  describe('buildCsv', () => {
    it('produces correct header and rows', () => {
      const payment = {
        id: 'pay-1',
        amount: 100,
        currency: 'USD',
        status: PaymentStatus.COMPLETED,
        externalReference: null,
        description: 'Test',
        feeAmount: 3,
        netAmount: 97,
        refundedAmount: 0,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      } as unknown as Payment;

      const csv = service.buildCsv('merchant-1', [payment]);
      const lines = csv.split('\n');

      expect(lines[0]).toBe(
        'ID,Amount,Currency,Status,ExternalRef,Description,FeeAmount,NetAmount,RefundedAmount,CreatedAt',
      );
      expect(lines[1]).toContain('pay-1');
      expect(lines[1]).toContain('100');
      expect(lines[1]).toContain('USD');
    });
  });
});
