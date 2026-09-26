import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { SettlementSchedule, ReserveStatus } from './merchant-settlement-config.entity';

export enum SettlementStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('settlements')
export class Settlement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  merchantId: string;

  @Column({ type: 'enum', enum: SettlementSchedule })
  schedule: SettlementSchedule;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  totalAmount: number;

  /** Amount withheld as reserve */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  reservedAmount: number = 0;

  /** Net amount after reserve (totalAmount - reservedAmount) */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  netAmount: number = 0;

  @Column({ length: 3 })
  currency: string;

  @Column({ type: 'uuid', nullable: true })
  payoutDestinationId: string | null = null;

  @Column({ nullable: true })
  transactionHash: string | null = null;

  @Column({ type: 'jsonb', default: [] })
  paymentIds: string[];

  @Column({ type: 'enum', enum: SettlementStatus, default: SettlementStatus.COMPLETED })
  status: SettlementStatus;

  @Column({ nullable: true })
  stellarTransactionHash: string | null;

  @Column({ nullable: true })
  failureReason: string | null;

  @Column()
  processedAt: Date;

  /** Date when reserved funds are released (processedAt + reserveDays) */
  @Column({ nullable: true })
  reservedReleaseAt: Date | null = null;

  @Column({ type: 'enum', enum: ReserveStatus, default: ReserveStatus.HELD })
  reserveStatus: ReserveStatus = ReserveStatus.HELD;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  releasedAmount: number = 0;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
