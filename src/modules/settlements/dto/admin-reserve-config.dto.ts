import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SetMerchantReserveConfigDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ description: 'Merchant ID (user ID)', example: '123e4567-e89b-12d3-a456-426614174000' })
  merchantId: string;

  @IsInt()
  @Min(0)
  @Max(50)
  @ApiProperty({ description: 'Reserve percentage (0-50)', example: 10, minimum: 0, maximum: 50 })
  reservePercent: number;

  @IsInt()
  @Min(1)
  @Max(180)
  @ApiProperty({ description: 'Number of days to hold the reserve (1-180)', example: 30, minimum: 1, maximum: 180 })
  reserveDays: number;
}

export class GetMerchantReserveConfigQueryDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ description: 'Merchant ID (user ID)', example: '123e4567-e89b-12d3-a456-426614174000' })
  merchantId: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ description: 'Currency code', example: 'USD' })
  currency: string;
}

export class MerchantReserveConfigResponseDto {
  @ApiProperty({ description: 'Merchant ID' })
  merchantId: string;

  @ApiProperty({ description: 'Currency code' })
  currency: string;

  @ApiProperty({ description: 'Reserve percentage' })
  reservePercent: number;

  @ApiProperty({ description: 'Number of days to hold reserve' })
  reserveDays: number;

  @ApiProperty({ description: 'Current total reserved amount' })
  totalReservedAmount: number;
}