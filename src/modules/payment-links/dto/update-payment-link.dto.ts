import {
  IsNumber,
  IsString,
  IsOptional,
  IsISO8601,
  IsBoolean,
  Min,
  MaxLength,
  IsPositive,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsEnum,
  Matches,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO4217CurrencyCode } from '../../../common/validators/is-iso4217-currency-code.validator';
import { Type } from 'class-transformer';

export class CustomFieldDto {
  @IsString()
  @IsOptional()
  @ApiPropertyOptional({ description: 'Unique key for the custom field', example: 'tshirt_size' })
  key?: string;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional({ description: 'Display label for the field', example: 'T-shirt Size' })
  label?: string;

  @IsEnum(['text', 'number', 'select'])
  @IsOptional()
  @ApiPropertyOptional({ enum: ['text', 'number', 'select'], description: 'Field type' })
  type?: 'text' | 'number' | 'select';

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @ApiPropertyOptional({ description: 'Options for select type fields', example: ['S', 'M', 'L', 'XL'] })
  options?: string[];

  @IsBoolean()
  @IsOptional()
  @ApiPropertyOptional({ description: 'Whether this field is required', example: true })
  required?: boolean;
}

export class RequiredFieldsDto {
  @IsBoolean()
  @IsOptional()
  @ApiPropertyOptional({ description: 'Require payer name', example: true })
  name?: boolean;

  @IsBoolean()
  @IsOptional()
  @ApiPropertyOptional({ description: 'Require payer email', example: true })
  email?: boolean;

  @IsBoolean()
  @IsOptional()
  @ApiPropertyOptional({ description: 'Require payer phone', example: false })
  phone?: boolean;
}

export class UpdatePaymentLinkDto {
  @IsBoolean()
  @IsOptional()
  @ApiPropertyOptional({ description: 'Whether the payment link is active', example: true })
  isActive?: boolean;

  @IsNumber()
  @IsOptional()
  @IsPositive({ message: 'Amount must be a positive number' })
  @Min(0.01, { message: 'Amount must be at least 0.01' })
  @ApiPropertyOptional({ description: 'Payment amount', example: 50.0, minimum: 0.01 })
  amount?: number;

  @IsString()
  @IsOptional()
  @IsISO4217CurrencyCode({ supportedOnly: true })
  @ApiPropertyOptional({ description: 'ISO 4217 currency code', example: 'USD' })
  currency?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  @ApiPropertyOptional({ description: 'Description shown on the checkout page', example: 'Invoice #42', maxLength: 500 })
  description?: string;

  @IsISO8601({}, { message: 'expiresAt must be a valid ISO 8601 date' })
  @IsOptional()
  @ApiPropertyOptional({ description: 'Optional expiry date (ISO 8601)', example: '2026-12-31T23:59:59Z' })
  expiresAt?: string;

  @IsString()
  @IsOptional()
  @Matches(/^[a-z0-9-]{3,64}$/, { message: 'Slug must be 3-64 characters, lowercase letters, numbers, and hyphens only' })
  @ApiPropertyOptional({ description: 'Custom URL-friendly slug (3-64 chars, lowercase letters, numbers, hyphens)', example: 'acme-tshirt' })
  slug?: string;

  @ValidateNested()
  @IsOptional()
  @Type(() => RequiredFieldsDto)
  @ApiPropertyOptional({ description: 'Required payer fields', type: RequiredFieldsDto })
  requiredFields?: RequiredFieldsDto;

  @IsArray()
  @ValidateNested({ each: true })
  @IsOptional()
  @ArrayMinSize(1)
  @ArrayMaxSize(5, { message: 'Maximum 5 custom fields allowed' })
  @Type(() => CustomFieldDto)
  @ApiPropertyOptional({ description: 'Custom fields to collect (max 5)', type: [CustomFieldDto] })
  customFields?: CustomFieldDto[];
}

