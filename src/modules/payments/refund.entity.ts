import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Payment } from './payment.entity';

export enum RefundReasonCode {
  DUPLICATE = 'DUPLICATE',
  FRAUDULENT = 'FRAUDULENT',
  REQUESTED_BY_CUSTOMER = 'REQUESTED_BY_CUSTOMER',
  PRODUCT_NOT_RECEIVED = 'PRODUCT_NOT_RECEIVED',
  PRODUCT_UNACCEPTABLE = 'PRODUCT_UNACCEPTABLE',
  OTHER = 'OTHER',
}

@Entity('refunds')
export class Refund {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty()
  id: string;

  @Column('uuid')
  @ApiProperty()
  paymentId: string;

  @ManyToOne(() => Payment)
  @JoinColumn({ name: 'paymentId' })
  payment: Payment;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  @ApiProperty()
  amount: number;

  @Column({
    type: 'enum',
    enum: RefundReasonCode,
    default: RefundReasonCode.OTHER,
  })
  @ApiProperty({ enum: RefundReasonCode })
  reasonCode: RefundReasonCode;

  @Column({ nullable: true })
  @ApiPropertyOptional()
  reason: string;

  @Column({ nullable: true })
  @ApiPropertyOptional({ description: 'User ID or system actor that initiated the refund' })
  initiatedBy: string | null;

  @CreateDateColumn()
  @ApiProperty()
  createdAt: Date;
}
