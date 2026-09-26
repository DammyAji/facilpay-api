import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PaymentLink } from './payment-link.entity';

export enum PaymentLinkEventType {
  VIEW = 'VIEW',
  REDEEM = 'REDEEM',
  COMPLETE = 'COMPLETE',
}

@Entity('payment_link_events')
@Index('idx_payment_link_events_link_id', ['paymentLinkId'])
@Index('idx_payment_link_events_created_at', ['createdAt'])
@Index('idx_payment_link_events_link_created', ['paymentLinkId', 'createdAt'])
export class PaymentLinkEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  paymentLinkId: string;

  @ManyToOne(() => PaymentLink, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'paymentLinkId' })
  paymentLink: PaymentLink;

  @Column({
    type: 'enum',
    enum: PaymentLinkEventType,
  })
  type: PaymentLinkEventType;

  @Column({ length: 64 })
  ipHash: string; // SHA256 of IP for deduplication

  @Column({ nullable: true })
  userAgent: string | null;

  @CreateDateColumn()
  createdAt: Date;
}