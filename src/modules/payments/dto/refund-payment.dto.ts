import {
  IsNumber,
  IsString,
  IsOptional,
  Min,
  MaxLength,
  IsPositive,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RefundReasonCode } from '../refund.entity';

export class RefundPaymentDto {
  @IsEnum(RefundReasonCode)
  @ApiProperty({ enum: RefundReasonCode, example: RefundReasonCode.OTHER })
  reasonCode: RefundReasonCode;

  @IsNumber()
  @IsOptional()
  @IsPositive({ message: 'Refund amount must be a positive number' })
  @Min(0.01, { message: 'Refund amount must be at least 0.01' })
  @ApiPropertyOptional({
    description:
      'Refund amount (defaults to full refund if not specified). Must not exceed remaining refundable amount.',
    example: 50.0,
    minimum: 0.01,
  })
  amount?: number;

  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'Reason must not exceed 500 characters' })
  @ApiPropertyOptional({
    description: 'Optional reason for the refund',
    example: 'Customer requested refund',
    maxLength: 500,
  })
  reason?: string;
}
