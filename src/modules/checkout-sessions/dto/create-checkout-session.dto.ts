import {
  ApiProperty,
  ApiPropertyOptional,
  PartialType,
} from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsInt,
  IsPositive,
  Min,
  MaxLength,
  IsUrl,
  IsEmail,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsISO4217CurrencyCode } from '../../../common/validators/is-iso4217-currency-code.validator';

export class LineItemDto {
  @ApiProperty({ description: 'Item name', example: 'Product 1' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ description: 'Item description', example: 'A great product' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ description: 'Quantity', example: 2 })
  @IsInt()
  @IsPositive()
  quantity: number;

  @ApiProperty({ description: 'Unit amount in smallest currency unit', example: 1000 })
  @IsInt()
  @IsPositive()
  @Min(1)
  unitAmount: number;
}

export class CreateCheckoutSessionDto {
  @ApiProperty({
    description: 'Line items for the checkout session',
    type: [LineItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineItemDto)
  lineItems: LineItemDto[];

  @ApiProperty({ description: 'Currency code (ISO 4217)', example: 'USD' })
  @IsString()
  @IsISO4217CurrencyCode({ supportedOnly: true })
  currency: string;

  @ApiPropertyOptional({ description: 'Customer ID from merchant system', example: 'cus_123' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  customerId?: string;

  @ApiPropertyOptional({ description: 'Customer email', example: 'customer@example.com' })
  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @ApiProperty({ description: 'Success redirect URL', example: 'https://example.com/success' })
  @IsString()
  @IsUrl()
  successUrl: string;

  @ApiProperty({ description: 'Cancel redirect URL', example: 'https://example.com/cancel' })
  @IsString()
  @IsUrl()
  cancelUrl: string;

  @ApiPropertyOptional({ description: 'Session expiry in minutes', example: 30, default: 30 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440) // Max 24 hours
  expiresInMinutes?: number;
}

export class UpdateCheckoutSessionDto extends PartialType(CreateCheckoutSessionDto) {}

export class CheckoutSessionResponseDto {
  @ApiProperty({ description: 'Session public ID for URLs' })
  publicId: string;

  @ApiProperty({ description: 'Full checkout URL for payer' })
  checkoutUrl: string;

  @ApiProperty({ description: 'Session status' })
  status: string;

  @ApiProperty({ description: 'Session expiry time' })
  expiresAt: Date;

  @ApiProperty({ description: 'Total amount in smallest currency unit' })
  total: number;

  @ApiProperty({ description: 'Currency code' })
  currency: string;
}

export class PublicCheckoutSessionDto {
  @ApiProperty({ description: 'Merchant display name' })
  merchantDisplayName: string;

  @ApiProperty({ description: 'Merchant logo URL' })
  merchantLogo: string | null;

  @ApiProperty({ description: 'Primary brand color' })
  primaryColor: string;

  @ApiProperty({ description: 'Line items' })
  lineItems: LineItemDto[];

  @ApiProperty({ description: 'Total amount formatted' })
  totalFormatted: string;

  @ApiProperty({ description: 'Session status' })
  status: string;

  @ApiProperty({ description: 'Whether session is expired' })
  isExpired: boolean;

  @ApiProperty({ description: 'Success URL' })
  successUrl: string;

  @ApiProperty({ description: 'Cancel URL' })
  cancelUrl: string;
}