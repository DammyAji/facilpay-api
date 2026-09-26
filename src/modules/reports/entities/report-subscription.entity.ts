import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ReportFrequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}

@Entity('report_subscriptions')
export class ReportSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  merchantId: string;

  @Column({ type: 'enum', enum: ReportFrequency, default: ReportFrequency.DAILY })
  frequency: ReportFrequency;

  /** Up to 5 recipient email addresses */
  @Column('text', { array: true })
  recipients: string[];

  /** IANA timezone identifier, e.g. "America/New_York" */
  @Column({ default: 'UTC' })
  timezone: string;

  @Column({ default: false })
  includeCsv: boolean;

  @Column({ default: true })
  isActive: boolean;

  /** Tracks when the last report was dispatched */
  @Column({ type: 'timestamp', nullable: true })
  lastSentAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
