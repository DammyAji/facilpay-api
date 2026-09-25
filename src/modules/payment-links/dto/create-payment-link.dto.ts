import {
  IsNumber,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsISO8601,
  Min,
  MaxLength,
  IsPositive,
  IsBoolean,
  ValidateIf,
  IsInt,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO4217CurrencyCode } from '../../../common/validators/is-iso4217-currency-code.validator';
import { Type } from 'class-transformer';

export class CreatePaymentLinkDto {
  @ValidateIf((o) => !o.flexibleAmount)
  @IsNumber()
  @IsNotEmpty()
  @IsPositive({ message: 'Amount must be a positive number' })
  @Min(0.01, { message: 'Amount must be at least 0.01' })
  @ApiPropertyOptional({ description: 'Fixed payment amount (required when flexibleAmount is false)', example: 50.0, minimum: 0.01 })
  amount?: number;

  @IsBoolean()
  @IsOptional()
  @ApiPropertyOptional({ description: 'Allow the payer to supply their own amount (e.g. donations)', example: true, default: false })
  flexibleAmount?: boolean;

  @ValidateIf((o) => o.flexibleAmount === true)
  @IsNumber()
  @IsOptional()
  @IsPositive()
  @Min(0.01)
  @ApiPropertyOptional({ description: 'Minimum amount the payer must supply (only for flexibleAmount links)', example: 1.0 })
  minAmount?: number;

  @IsString()
  @IsNotEmpty({ message: 'Currency is required' })
  @IsISO4217CurrencyCode({ supportedOnly: true })
  @ApiProperty({ description: 'ISO 4217 currency code', example: 'USD' })
  currency: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  @ApiPropertyOptional({ description: 'Description shown on the checkout page', example: 'Invoice #42', maxLength: 500 })
  description?: string;

  @IsISO8601({}, { message: 'expiresAt must be a valid ISO 8601 date' })
  @IsOptional()
  @ApiPropertyOptional({ description: 'Optional expiry date (ISO 8601)', example: '2026-12-31T23:59:59Z' })
  expiresAt?: string;

  @IsInt()
  @Min(1, { message: 'maxCompletions must be at least 1' })
  @IsOptional()
  @ApiPropertyOptional({ description: 'Maximum number of completed payments before the link deactivates', example: 1, minimum: 1 })
  maxCompletions?: number;
}
