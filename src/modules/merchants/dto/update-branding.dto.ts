import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength, IsEmail, IsUrl, Matches } from 'class-validator';

export class UpdateBrandingDto {
  @ApiPropertyOptional({ description: 'Merchant display name', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @ApiPropertyOptional({ description: 'Primary brand color in hex format', example: '#1a1a2e' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'primaryColor must be a valid hex color (e.g., #1a1a2e)' })
  primaryColor?: string;

  @ApiPropertyOptional({ description: 'Support email address', example: 'support@merchant.com' })
  @IsOptional()
  @IsString()
  @IsEmail({}, { message: 'supportEmail must be a valid email address' })
  supportEmail?: string;

  @ApiPropertyOptional({ description: 'Support URL', example: 'https://merchant.com/support' })
  @IsOptional()
  @IsString()
  @IsUrl({}, { message: 'supportUrl must be a valid URL' })
  supportUrl?: string;
}

export class CreateBrandingDto extends UpdateBrandingDto {}