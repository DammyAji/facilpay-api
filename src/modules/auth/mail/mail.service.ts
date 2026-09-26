import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Settlement } from '../../settlements/entities/settlement.entity';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST', 'smtp.ethereal.email'),
      port: this.configService.get<number>('SMTP_PORT', 587),
      secure:
        this.configService.get<string>('SMTP_SECURE', 'false') === 'true',
      auth: {
        user: this.configService.get<string>('SMTP_USER', ''),
        pass: this.configService.get<string>('SMTP_PASS', ''),
      },
    });
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const appUrl = this.configService.get<string>(
      'APP_URL',
      'http://localhost:3000',
    );
    const verifyUrl = `${appUrl}/auth/verify-email?token=${token}`;

    await this.transporter.sendMail({
      from: this.configService.get<string>(
        'SMTP_FROM',
        '"FacilPay" <noreply@facilpay.com>',
      ),
      to,
      subject: 'Verify your FacilPay email address',
      text: `Click the link to verify your email: ${verifyUrl}`,
      html: `<p>Click the link to verify your email address:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>This link expires in 24 hours.</p>`,
    });
  }

  async sendSettlementNotification(
    to: string,
    settlement: Settlement,
    totalAmount: number,
  ): Promise<void> {
    await this.transporter.sendMail({
      from: this.configService.get<string>('SMTP_FROM', '"FacilPay" <noreply@facilpay.com>'),
      to,
      subject: `FacilPay: Your ${settlement.schedule} settlement has been processed`,
      text:
        `Your ${settlement.schedule} settlement has been processed.\n\n` +
        `Total: ${totalAmount} ${settlement.currency}\n` +
        `Payments included: ${settlement.paymentIds.length}\n` +
        `Processed at: ${settlement.processedAt.toISOString()}`,
      html:
        `<p>Your <strong>${settlement.schedule}</strong> settlement has been processed.</p>` +
        `<ul>` +
        `<li>Total: <strong>${totalAmount} ${settlement.currency}</strong></li>` +
        `<li>Payments included: ${settlement.paymentIds.length}</li>` +
        `<li>Processed at: ${settlement.processedAt.toISOString()}</li>` +
        `</ul>`,
    });
  }

  async sendPayoutDestinationVerificationEmail(
    to: string,
    destinationId: string,
    label: string,
    token: string,
  ): Promise<void> {
    const appUrl = this.configService.get<string>('APP_URL', 'http://localhost:3000');
    const verifyUrl = `${appUrl}/v1/settlements/destinations/${destinationId}/verify?token=${encodeURIComponent(token)}`;

    await this.transporter.sendMail({
      from: this.configService.get<string>('SMTP_FROM', '"FacilPay" <noreply@facilpay.com>'),
      to,
      subject: 'Confirm your FacilPay payout destination',
      text: `Confirm the payout destination "${label}" by opening: ${verifyUrl}. This link expires in 24 hours.`,
      html: `<p>Confirm the payout destination <strong>${label}</strong> by clicking the link below.</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>This link expires in 24 hours.</p>`,
    });
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const appUrl = this.configService.get<string>(
      'APP_URL',
      'http://localhost:3000',
    );
    const resetUrl = `${appUrl}/auth/reset-password?token=${token}`;

    await this.transporter.sendMail({
      from: this.configService.get<string>(
        'SMTP_FROM',
        '"FacilPay" <noreply@facilpay.com>',
      ),
      to,
      subject: 'Reset your FacilPay password',
      text: `Click the link to reset your password: ${resetUrl}`,
      html: `<p>You requested to reset your password.</p><p>Click the link below to reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>This link expires in 1 hour.</p><p>If you did not request this, please ignore this email.</p>`,
    });
  }

  async sendPasswordChangedEmail(to: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.configService.get<string>(
        'SMTP_FROM',
        '"FacilPay" <noreply@facilpay.com>',
      ),
      to,
      subject: 'Your FacilPay password was changed',
      text: 'Your password was changed successfully. If you did not make this change, contact support immediately.',
      html: '<p>Your password was changed successfully.</p><p>If you did not make this change, contact support immediately.</p>',
    });
  }

  async sendTwoFactorDisabledEmail(to: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.configService.get<string>(
        'SMTP_FROM',
        '"FacilPay" <noreply@facilpay.com>',
      ),
      to,
      subject: 'Two-factor authentication was disabled on your FacilPay account',
      text: 'Two-factor authentication has been disabled for your account. If you did not do this, please secure your account immediately.',
      html: '<p>Two-factor authentication has been disabled for your account.</p><p>If you did not do this, please secure your account immediately.</p>',
    });
  }

  async sendAccountLockedEmail(to: string, lockDurationMinutes: number): Promise<void> {
    await this.transporter.sendMail({
      from: this.configService.get<string>(
        'SMTP_FROM',
        '"FacilPay" <noreply@facilpay.com>',
      ),
      to,
      subject: 'Your FacilPay account has been locked',
      text: `Your account has been temporarily locked after repeated failed login attempts. It will unlock in ${lockDurationMinutes} minutes. If this was not you, secure your account immediately.`,
      html: `<p>Your account has been temporarily locked after repeated failed login attempts.</p><p>It will unlock in <strong>${lockDurationMinutes}</strong> minutes.</p><p>If this was not you, secure your account immediately.</p>`,
    });
  }
}
