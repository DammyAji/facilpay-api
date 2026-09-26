import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AppLogger } from '../logger/logger.service';
import { Logger } from 'pino';
import { EmailEventType } from './email-log.entity';
import { SendEmailJobData } from './email.processor';
import type { ReportSummary } from '../reports/reports.service';

@Injectable()
export class EmailNotificationService {
  private readonly logger: Logger;

  constructor(
    @InjectQueue('emails') private readonly emailQueue: Queue,
    appLogger: AppLogger,
  ) {
    this.logger = appLogger.child({ module: EmailNotificationService.name });
  }

  async sendMerchantPaymentReceived(
    to: string,
    merchantName: string | null,
    paymentId: string,
    amount: string,
    currency: string,
    description: string | null,
  ): Promise<void> {
    await this.enqueue({
      to,
      subject: `Payment Received: ${amount} ${currency}`,
      templateName: 'merchant-payment-received',
      templateData: {
        merchantName: merchantName || undefined,
        paymentAmount: amount,
        paymentCurrency: currency,
        paymentId,
        paymentDescription: description || undefined,
      },
      eventType: EmailEventType.PAYMENT_RECEIVED,
      recipientRole: 'merchant',
      paymentId,
    });
  }

  async sendMerchantRefundIssued(
    to: string,
    merchantName: string | null,
    paymentId: string,
    refundId: string,
    refundAmount: string,
    paymentAmount: string,
    currency: string,
    reason: string | null,
  ): Promise<void> {
    await this.enqueue({
      to,
      subject: `Refund Issued: ${refundAmount} ${currency}`,
      templateName: 'merchant-refund-issued',
      templateData: {
        merchantName: merchantName || undefined,
        paymentAmount: paymentAmount,
        paymentCurrency: currency,
        paymentId,
        refundId,
        refundAmount,
        refundReason: reason || undefined,
      },
      eventType: EmailEventType.REFUND_ISSUED,
      recipientRole: 'merchant',
      paymentId,
      refundId,
    });
  }

  async sendMerchantDisputeOpened(
    to: string,
    merchantName: string | null,
    paymentId: string,
    disputeId: string,
    amount: string,
    currency: string,
    reason: string | null,
  ): Promise<void> {
    await this.enqueue({
      to,
      subject: `Dispute Opened: ${amount} ${currency}`,
      templateName: 'merchant-dispute-opened',
      templateData: {
        merchantName: merchantName || undefined,
        paymentAmount: amount,
        paymentCurrency: currency,
        paymentId,
        disputeId,
        disputeReason: reason || undefined,
      },
      eventType: EmailEventType.DISPUTE_OPENED,
      recipientRole: 'merchant',
      paymentId,
    });
  }

  async sendPayerDisputeOpened(
    to: string,
    payerName: string | null,
    paymentId: string,
    disputeId: string,
    amount: string,
    currency: string,
    reason: string | null,
  ): Promise<void> {
    await this.enqueue({
      to,
      subject: `Dispute Opened: ${amount} ${currency}`,
      templateName: 'payer-dispute-opened',
      templateData: {
        payerName: payerName || undefined,
        paymentAmount: amount,
        paymentCurrency: currency,
        paymentId,
        disputeId,
        disputeReason: reason || undefined,
      },
      eventType: EmailEventType.DISPUTE_OPENED,
      recipientRole: 'payer',
      paymentId,
      includeUnsubscribe: true,
    });
  }

  async sendMerchantDisputeStatusChanged(
    to: string,
    merchantName: string | null,
    paymentId: string,
    disputeId: string,
    amount: string,
    currency: string,
    previousStatus: string,
    newStatus: string,
    resolutionNotes: string | null,
  ): Promise<void> {
    await this.enqueue({
      to,
      subject: `Dispute Status Updated: ${newStatus}`,
      templateName: 'merchant-dispute-status-changed',
      templateData: {
        merchantName: merchantName || undefined,
        paymentAmount: amount,
        paymentCurrency: currency,
        paymentId,
        disputeId,
        previousStatus,
        newStatus,
        resolutionNotes: resolutionNotes || undefined,
      },
      eventType: EmailEventType.DISPUTE_STATUS_CHANGED,
      recipientRole: 'merchant',
      paymentId,
    });
  }

  async sendPayerDisputeStatusChanged(
    to: string,
    payerName: string | null,
    paymentId: string,
    disputeId: string,
    amount: string,
    currency: string,
    previousStatus: string,
    newStatus: string,
    resolutionNotes: string | null,
  ): Promise<void> {
    await this.enqueue({
      to,
      subject: `Dispute Status Updated: ${newStatus}`,
      templateName: 'payer-dispute-status-changed',
      templateData: {
        payerName: payerName || undefined,
        paymentAmount: amount,
        paymentCurrency: currency,
        paymentId,
        disputeId,
        previousStatus,
        newStatus,
        resolutionNotes: resolutionNotes || undefined,
      },
      eventType: EmailEventType.DISPUTE_STATUS_CHANGED,
      recipientRole: 'payer',
      paymentId,
      includeUnsubscribe: true,
    });
  }

  async sendPayerPaymentConfirmed(
    to: string,
    payerName: string | null,
    paymentId: string,
    amount: string,
    currency: string,
    description: string | null,
  ): Promise<void> {
    await this.enqueue({
      to,
      subject: `Payment Confirmed: ${amount} ${currency}`,
      templateName: 'payer-payment-confirmed',
      templateData: {
        payerName: payerName || undefined,
        paymentAmount: amount,
        paymentCurrency: currency,
        paymentId,
        paymentDescription: description || undefined,
        date: new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
      },
      eventType: EmailEventType.PAYMENT_CONFIRMED,
      recipientRole: 'payer',
      paymentId,
      includeUnsubscribe: true,
    });
  }

  async sendPayerRefundProcessed(
    to: string,
    payerName: string | null,
    paymentId: string,
    refundId: string,
    refundAmount: string,
    currency: string,
    reason: string | null,
  ): Promise<void> {
    await this.enqueue({
      to,
      subject: `Refund Processed: ${refundAmount} ${currency}`,
      templateName: 'payer-refund-processed',
      templateData: {
        payerName: payerName || undefined,
        paymentAmount: '', // not needed for payer
        paymentCurrency: currency,
        paymentId,
        refundId,
        refundAmount,
        refundReason: reason || undefined,
      },
      eventType: EmailEventType.REFUND_PROCESSED,
      recipientRole: 'payer',
      paymentId,
      refundId,
      includeUnsubscribe: true,
    });
  }

  async sendPayerRecurringPaymentReminder(
    to: string,
    payerName: string | null,
    planId: string,
    amount: string,
    currency: string,
    chargeDate: Date,
    merchantEmail: string,
    manageUrl: string,
    cancelUrl: string,
    description: string | null,
  ): Promise<void> {
    const formattedDate = chargeDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    await this.enqueue({
      to,
      subject: `Upcoming Charge: ${amount} ${currency} on ${formattedDate}`,
      templateName: 'payer-recurring-payment-reminder',
      templateData: {
        payerName: payerName || undefined,
        paymentAmount: amount,
        paymentCurrency: currency,
        chargeDate: formattedDate,
        merchantEmail,
        manageUrl,
        cancelUrl,
        planDescription: description || undefined,
      },
      eventType: EmailEventType.PAYMENT_CONFIRMED,
      recipientRole: 'payer',
      paymentId: planId,
      includeUnsubscribe: true,
    });
  }

  async sendWebhookEndpointDisabled(
    to: string,
    endpointUrl: string,
    consecutiveFailures: number,
    lastError: string,
    reenableUrl: string,
  ): Promise<void> {
    await this.enqueue({
      to,
      subject: `Webhook Endpoint Disabled: ${endpointUrl}`,
      templateName: 'merchant-webhook-endpoint-disabled',
      templateData: {
        endpointUrl,
        consecutiveFailures,
        lastError,
        reenableUrl,
      },
      eventType: EmailEventType.PAYMENT_RECEIVED,
      recipientRole: 'merchant',
    });
  }

  async sendMerchantReport(
    to: string,
    summary: ReportSummary,
    subscriptionId: string,
    csvContent?: string,
  ): Promise<void> {
    const periodLabel = summary.periodStart.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const periodEnd = summary.periodEnd.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const attachments = csvContent
      ? [
          {
            filename: `report-${summary.periodStart.toISOString().slice(0, 10)}.csv`,
            content: csvContent,
            contentType: 'text/csv',
          },
        ]
      : undefined;

    await this.enqueue({
      to,
      subject: `Your ${summary.frequency.toLowerCase()} FacilPay report — ${periodLabel}`,
      templateName: 'merchant-report-summary',
      templateData: {
        frequency: summary.frequency,
        periodStart: periodLabel,
        periodEnd,
        totalPayments: summary.totalPayments,
        completedPayments: summary.completedPayments,
        totalVolume: summary.totalVolume.toFixed(2),
        totalFees: summary.totalFees.toFixed(2),
        totalNetAmount: summary.totalNetAmount.toFixed(2),
        totalRefunds: summary.totalRefunds.toFixed(2),
        refundCount: summary.refundCount,
        currency: summary.currency,
        subscriptionId,
        attachments,
      },
      eventType: EmailEventType.PAYMENT_RECEIVED,
      recipientRole: 'merchant',
      includeUnsubscribe: true,
    });
  }

  private async enqueue(data: SendEmailJobData): Promise<void> {
    await this.emailQueue.add('send', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    });
  }

  /**
   * Send invoice reminder email with merchant branding
   */
  async sendInvoiceReminder(
    to: string,
    branding: {
      displayName: string;
      logo: string | null;
      primaryColor: string;
      supportEmail: string | null;
      supportUrl: string | null;
    },
    data: {
      paymentId: string;
      amount: string;
      currency: string;
      dueDate: string;
      reminderType: 'BEFORE' | 'ON_DUE' | 'AFTER';
      daysUntilDue?: number;
    },
  ): Promise<void> {
    let subject: string;
    let previewText: string;

    switch (data.reminderType) {
      case 'BEFORE':
        subject = `Reminder: Invoice due in ${data.daysUntilDue} days`;
        previewText = `Your invoice from ${branding.displayName} is due soon.`;
        break;
      case 'ON_DUE':
        subject = 'Invoice due today';
        previewText = `Your invoice from ${branding.displayName} is due today.`;
        break;
      case 'AFTER':
        subject = 'Urgent: Invoice overdue';
        previewText = `Your invoice from ${branding.displayName} is now overdue.`;
        break;
    }

    await this.enqueue({
      to,
      subject,
      templateName: 'invoice-reminder',
      templateData: {
        merchantName: branding.displayName,
        merchantLogo: branding.logo,
        primaryColor: branding.primaryColor,
        supportEmail: branding.supportEmail,
        supportUrl: branding.supportUrl,
        paymentId: data.paymentId,
        amount: data.amount,
        currency: data.currency,
        dueDate: data.dueDate,
        previewText,
      },
      eventType: EmailEventType.PAYMENT_RECEIVED, // Could add new type
      recipientRole: 'payer',
      paymentId: data.paymentId,
      includeUnsubscribe: true,
    });
  }

  /**
   * Send payment confirmation with merchant branding
   */
  async sendPayerPaymentConfirmedWithBranding(
    to: string,
    branding: {
      displayName: string;
      logo: string | null;
      primaryColor: string;
      supportEmail: string | null;
      supportUrl: string | null;
    },
    data: {
      payerName: string | null;
      paymentId: string;
      amount: string;
      currency: string;
      description: string | null;
    },
  ): Promise<void> {
    await this.enqueue({
      to,
      subject: `Payment Confirmed: ${data.amount} ${data.currency}`,
      templateName: 'payer-payment-confirmed',
      templateData: {
        merchantName: branding.displayName,
        merchantLogo: branding.logo,
        primaryColor: branding.primaryColor,
        supportEmail: branding.supportEmail,
        supportUrl: branding.supportUrl,
        payerName: data.payerName || undefined,
        paymentAmount: data.amount,
        paymentCurrency: data.currency,
        paymentId: data.paymentId,
        paymentDescription: data.description || undefined,
        date: new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
      },
      eventType: EmailEventType.PAYMENT_CONFIRMED,
      recipientRole: 'payer',
      paymentId: data.paymentId,
      includeUnsubscribe: true,
    });
  }
}
