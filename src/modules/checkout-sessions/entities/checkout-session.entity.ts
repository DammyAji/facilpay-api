import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum CheckoutSessionStatus {
  OPEN = 'OPEN',
  COMPLETE = 'COMPLETE',
  EXPIRED = 'EXPIRED',
}

export type LineItem = {
  name: string;
  description?: string;
  quantity: number;
  unitAmount: number; // In smallest currency unit (e.g., cents)
};

@Entity('checkout_sessions')
@Index('idx_checkout_sessions_merchant_id', ['merchantId'])
@Index('idx_checkout_sessions_public_id', ['publicId'], { unique: true })
export class CheckoutSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ length: 32 })
  publicId: string; // Public-facing ID for URLs

  @Column()
  merchantId: string;

  @Column('jsonb', { default: [] })
  lineItems: LineItem[];

  @Column({ length: 3 })
  currency: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total: number;

  @Column({ nullable: true })
  customerId: string | null;

  @Column({ nullable: true })
  customerEmail: string | null;

  @Column()
  successUrl: string;

  @Column()
  cancelUrl: string;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({
    type: 'enum',
    enum: CheckoutSessionStatus,
    default: CheckoutSessionStatus.OPEN,
  })
  status: CheckoutSessionStatus;

  @Column({ nullable: true })
  paymentId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}