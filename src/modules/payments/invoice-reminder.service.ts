import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual, In } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Payment, PaymentStatus } from './payment.entity';
import { InvoiceReminder, InvoiceReminderType } from './invoice-reminder.entity';
import { MerchantsService } from '../merchants/merchants.service';
import { AppLogger } from '../logger/logger.service';

@Injectable()
export class InvoiceReminderService {
  private readonly logger: Logger;

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(InvoiceReminder)
    private readonly reminderRepo: Repository<InvoiceReminder>,
    private readonly merchantsService: MerchantsService,
    appLogger: AppLogger,
  ) {
    this.logger = appLogger.child({ module: InvoiceReminderService.name });
  }

  /**
   * Daily cron job to:
   * 1. Mark OPEN (PENDING) payments past dueDate as OVERDUE
   * 2. Process and send due reminders
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async processInvoiceReminders(): Promise<void> {
    this.logger.info('Starting invoice reminder processing');
    const now = new Date();

    // Step 1: Mark overdue payments
    await this.markOverduePayments(now);

    // Step 2: Send reminders
    await this.sendReminders(now);

    this.logger.info('Invoice reminder processing completed');
  }

  /**
   * Mark PENDING payments past their dueDate as OVERDUE
   */
  private async markOverduePayments(now: Date): Promise<number> {
    const result = await this.paymentRepo
      .createQueryBuilder()
      .update(Payment)
      .set({ status: PaymentStatus.OVERDUE })
      .where('status = :status', { status: PaymentStatus.PENDING })
      .andWhere('dueDate IS NOT NULL')
      .andWhere('dueDate < :now', { now })
      .andWhere('remindersEnabled = :enabled', { enabled: true })
      .execute();

    const affected = result.affected || 0;
    if (affected > 0) {
      this.logger.info({ count: affected }, 'Marked payments as overdue');
    }
    return affected;
  }

  /**
   * Process and send reminders based on merchant settings and payment due dates
   */
  private async sendReminders(now: Date): Promise<void> {
    // Get all payments with due dates that need reminders
    const paymentsWithDueDate = await this.paymentRepo.find({
      where: [
        { status: PaymentStatus.PENDING, dueDate: MoreThanOrEqual(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)) },
        { status: PaymentStatus.OVERDUE, dueDate: MoreThanOrEqual(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)) },
      ],
      relations: ['merchant'],
    });

    for (const payment of paymentsWithDueDate) {
      if (!payment.merchantId || !payment.remindersEnabled) {
        continue;
      }

      // Get merchant reminder settings
      const settings = await this.merchantsService.getSettingsWithDefaults(payment.merchantId);
      if (!settings.remindersEnabled) {
        continue;
      }

      // Process each reminder offset
      for (const offset of settings.reminderOffsets) {
        await this.processReminder(payment, offset, now);
      }
    }
  }

  /**
   * Process a single reminder for a payment
   */
  private async processReminder(payment: Payment, offset: number, now: Date): Promise<void> {
    if (!payment.dueDate) return;

    // Calculate the reminder date
    const reminderDate = new Date(payment.dueDate);
    reminderDate.setDate(reminderDate.getDate() + offset);

    // Check if today is the reminder date (within the same day)
    const isToday =
      reminderDate.getFullYear() === now.getFullYear() &&
      reminderDate.getMonth() === now.getMonth() &&
      reminderDate.getDate() === now.getDate();

    if (!isToday) return;

    // Determine reminder type
    const type = this.getReminderType(offset);

    // Check if reminder already sent
    const existingReminder = await this.reminderRepo.findOneBy({
      paymentId: payment.id,
      type,
    });

    if (existingReminder) {
      return; // Already sent
    }

    // Send the reminder
    await this.sendReminderEmail(payment, type);

    // Record the reminder
    const reminder = this.reminderRepo.create({
      paymentId: payment.id,
      type,
      sentAt: now,
    });
    await this.reminderRepo.save(reminder);

    this.logger.info({ paymentId: payment.id, type, offset }, 'Reminder sent');
  }

  /**
   * Map offset to reminder type
   */
  private getReminderType(offset: number): InvoiceReminderType {
    if (offset < 0) return InvoiceReminderType.BEFORE;
    if (offset === 0) return InvoiceReminderType.ON_DUE;
    return InvoiceReminderType.AFTER;
  }

  /**
   * Send reminder email to the payer
   */
  private async sendReminderEmail(payment: Payment, type: InvoiceReminderType): Promise<void> {
    if (!payment.payerEmail) {
      this.logger.warn({ paymentId: payment.id }, 'No payer email, skipping reminder');
      return;
    }

    // Get merchant branding for email customisation
    const branding = await this.merchantsService.getBrandingWithDefaults(payment.merchantId || '');

    // Build email content based on reminder type
    const emailData = this.buildReminderEmailData(payment, type, branding);

    // TODO: Integrate with actual email service
    this.logger.info(
      { paymentId: payment.id, payerEmail: payment.payerEmail, type },
      'Would send reminder email',
    );
    // await this.emailService.send(emailData);
  }

  /**
   * Build email data for reminder
   */
  private buildReminderEmailData(
    payment: Payment,
    type: InvoiceReminderType,
    branding: { displayName: string; logo: string | null; primaryColor: string },
  ): {
    to: string;
    subject: string;
    template: string;
    context: Record<string, any>;
  } {
    const dueDateStr = payment.dueDate?.toLocaleDateString() || 'N/A';
    const amountStr = `${payment.currency} ${Number(payment.amount).toFixed(2)}`;

    let subject: string;
    let previewText: string;

    switch (type) {
      case InvoiceReminderType.BEFORE:
        subject = `Reminder: Invoice due in ${Math.abs(this.getOffsetForType(payment))} days`;
        previewText = `Your invoice from ${branding.displayName} is due soon.`;
        break;
      case InvoiceReminderType.ON_DUE:
        subject = 'Invoice due today';
        previewText = `Your invoice from ${branding.displayName} is due today.`;
        break;
      case InvoiceReminderType.AFTER:
        subject = 'Urgent: Invoice overdue';
        previewText = `Your invoice from ${branding.displayName} is now overdue.`;
        break;
    }

    return {
      to: payment.payerEmail,
      subject,
      template: 'invoice-reminder',
      context: {
        merchantName: branding.displayName,
        merchantLogo: branding.logo,
        primaryColor: branding.primaryColor,
        amount: amountStr,
        dueDate: dueDateStr,
        paymentId: payment.id,
        previewText,
      },
    };
  }

  /**
   * Helper to get offset for a given reminder type (simplified)
   */
  private getOffsetForType(payment: Payment): number {
    return 3; // Default for BEFORE type
  }

  /**
   * Check if a reminder was already sent for a payment and type
   */
  async hasReminderBeenSent(paymentId: string, type: InvoiceReminderType): Promise<boolean> {
    const reminder = await this.reminderRepo.findOneBy({ paymentId, type });
    return !!reminder;
  }
}