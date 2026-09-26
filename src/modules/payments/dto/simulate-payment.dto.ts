import { IsEnum, IsOptional, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentStatus } from '../payment.entity';

export enum SimulateOutcome {
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
  PARTIALLY_COMPLETED = 'PARTIALLY_COMPLETED',
}

export class SimulatePaymentDto {
  @ApiProperty({
    enum: SimulateOutcome,
    description: 'Target outcome to force on the payment',
    example: SimulateOutcome.COMPLETED,
  })
  @IsEnum(SimulateOutcome)
  outcome: SimulateOutcome;

  /**
   * Optional override amount for PARTIALLY_COMPLETED outcomes.
   * Ignored for other outcomes.
   */
  @ApiPropertyOptional({
    description: 'Partial completion amount (only for PARTIALLY_COMPLETED)',
    example: 25.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;
}
