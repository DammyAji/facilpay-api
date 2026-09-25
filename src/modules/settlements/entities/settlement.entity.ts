import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { SettlementSchedule } from './merchant-settlement-config.entity';

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

  @Column({ length: 3 })
  currency: string;

  @Column({ type: 'uuid', nullable: true })
  payoutDestinationId: string | null = null;

  @Column({ nullable: true })
  transactionHash: string | null = null;

  @Column({ type: 'jsonb', default: [] })
  paymentIds: string[];

  @Column()
  processedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
