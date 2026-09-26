import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Payment } from './payment.entity';

export enum InvoiceReminderType {
  BEFORE = 'BEFORE',    // Before due date
  ON_DUE = 'ON_DUE',    // On due date
  AFTER = 'AFTER',      // After due date
}

@Entity('invoice_reminders')
@Index('idx_invoice_reminders_payment_type', ['paymentId', 'type'], { unique: true })
export class InvoiceReminder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  paymentId: string;

  @ManyToOne(() => Payment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'paymentId' })
  payment: Payment;

  @Column({
    type: 'enum',
    enum: InvoiceReminderType,
  })
  type: InvoiceReminderType;

  @Column()
  sentAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}