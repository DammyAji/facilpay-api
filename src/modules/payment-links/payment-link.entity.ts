import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('payment_links')
export class PaymentLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ length: 32 })
  token: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  amount: number | null;

  @Column({ default: false })
  flexibleAmount: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  minAmount: number | null;

  @Column({ length: 3 })
  currency: string;

  @Column({ nullable: true, length: 500 })
  description: string | null = null;

  @Column({ nullable: true })
  expiresAt: Date | null = null;

  @Column({ default: true })
  isActive: boolean = true;

  @Column({ default: 0 })
  views: number;

  @Column({ default: 0 })
  completions: number;

  @Column({ type: 'integer', nullable: true })
  maxCompletions: number | null = null;

  @Column()
  merchantId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
