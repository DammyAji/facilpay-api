import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('payout_destinations')
@Index(['merchantId', 'assetCode', 'stellarAddress'], { unique: true })
export class PayoutDestination {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  merchantId: string;

  @Column({ length: 100 })
  label: string;

  @Column({ length: 56 })
  stellarAddress: string;

  @Column({ length: 12 })
  assetCode: string;

  @Column({ default: false })
  isDefault: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  verifiedAt: Date | null = null;

  @Column({ type: 'timestamptz', nullable: true })
  coolingOffUntil: Date | null = null;

  @Column({ length: 128, nullable: true })
  verificationTokenHash: string | null = null;

  @Column({ type: 'timestamptz', nullable: true })
  verificationTokenExpiresAt: Date | null = null;

  @CreateDateColumn()
  createdAt: Date;
}