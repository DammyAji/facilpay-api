import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum WebhookReplayStatus {
  PROCESSING = 'processing',
  FAILED = 'failed',
}

@Entity('webhook_replays')
@Index('IDX_webhook_replays_merchant_createdAt', ['merchantId', 'createdAt'])
export class WebhookReplay {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  endpointId: string;

  @Column({ type: 'uuid' })
  merchantId: string;

  @Column({ type: 'int' })
  totalEvents: number;

  @Column({ type: 'varchar', length: 20, default: WebhookReplayStatus.PROCESSING })
  status: WebhookReplayStatus;

  @Column({ type: 'text', nullable: true })
  failureReason: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}