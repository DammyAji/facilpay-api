import {
  IsString,
  IsOptional,
  IsEmail,
  IsLength,
  IsISO3166Alpha2,
  IsTimeZone,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OnboardingStatus } from '../../onboarding/merchant-onboarding.entity';
import { IsISO4217CurrencyCode } from '../../../common/validators/is-iso4217-currency-code.validator';

export class MerchantProfileResponseDto {
  @ApiProperty({ description: 'Merchant/user ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  merchantId: string;

  @ApiPropertyOptional({ description: 'Business display name', example: 'Acme Corp' })
  businessName?: string | null;

  @ApiPropertyOptional({ description: 'Legal registered business name', example: 'Acme Incorporated' })
  legalName?: string | null;

  @ApiPropertyOptional({ description: 'Business website URL', example: 'https://acme.com' })
  website?: string | null;

  @ApiPropertyOptional({ description: 'Support email', example: 'support@acme.com' })
  supportEmail?: string | null;

  @ApiPropertyOptional({ description: 'Support phone number', example: '+1-555-123-4567' })
  supportPhone?: string | null;

  @ApiPropertyOptional({ description: 'Country code (ISO 3166-1 alpha-2)', example: 'US' })
  country?: string | null;

  @ApiPropertyOptional({ description: 'Timezone', example: 'America/New_York' })
  timezone?: string | null;

  @ApiPropertyOptional({ description: 'Default currency (ISO 4217)', example: 'USD' })
  defaultCurrency?: string | null;

  @ApiProperty({ enum: OnboardingStatus, description: 'Onboarding status' })
  status: OnboardingStatus;

  @ApiProperty({ description: 'Whether profile changes require re-review', example: false })
  requiresReReview: boolean;
}

export class UpdateMerchantProfileDto {
  @IsString()
  @IsOptional()
  @IsLength(1, 255)
  @ApiPropertyOptional({ description: 'Business display name', example: 'Acme Corp', maxLength: 255 })
  businessName?: string;

  @IsString()
  @IsOptional()
  @IsLength(1, 255)
  @ApiPropertyOptional({ description: 'Legal registered business name (change triggers re-review)', example: 'Acme Incorporated', maxLength: 255 })
  legalName?: string;

  @IsString()
  @IsOptional()
  @IsLength(1, 500)
  @ApiPropertyOptional({ description: 'Business website URL', example: 'https://acme.com', maxLength: 500 })
  website?: string;

  @IsEmail()
  @IsOptional()
  @ApiPropertyOptional({ description: 'Support email', example: 'support@acme.com' })
  supportEmail?: string;

  @IsString()
  @IsOptional()
  @IsLength(7, 20)
  @ApiPropertyOptional({ description: 'Support phone number', example: '+1-555-123-4567', minLength: 7, maxLength: 20 })
  supportPhone?: string;

  @IsISO3166Alpha2()
  @IsOptional()
  @ApiPropertyOptional({ description: 'Country code (ISO 3166-1 alpha-2) - change triggers re-review', example: 'US' })
  country?: string;

  @IsTimeZone()
  @IsOptional()
  @ApiPropertyOptional({ description: 'Timezone', example: 'America/New_York' })
  timezone?: string;

  @IsISO4217CurrencyCode({ supportedOnly: true })
  @IsOptional()
  @ApiPropertyOptional({ description: 'Default currency (ISO 4217)', example: 'USD' })
  defaultCurrency?: string;
}