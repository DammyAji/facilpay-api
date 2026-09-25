import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum SettlementSchedule {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

@Entity('merchant_settlement_configs')
@Index(['userId', 'currency'], { unique: true })
export class MerchantSettlementConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ type: 'enum', enum: SettlementSchedule, default: SettlementSchedule.MONTHLY })
  schedule: SettlementSchedule;

  @Column({ length: 3 })
  currency: string;

  @Column({ type: 'uuid', nullable: true })
  destinationId: string | null = null;

  @Column({ nullable: true })
  lastSettledAt: Date | null = null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
