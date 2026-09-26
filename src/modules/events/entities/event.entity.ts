import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('events')
@Index('idx_events_merchant_id', ['merchantId'])
@Index('idx_events_type', ['type'])
@Index('idx_events_created_at', ['createdAt'])
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  merchantId: string | null;

  @Column({ length: 128 })
  type: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}