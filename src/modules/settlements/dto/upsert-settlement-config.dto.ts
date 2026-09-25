import { IsEnum, IsNotEmpty, IsString, IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SettlementSchedule } from '../entities/merchant-settlement-config.entity';
import { IsISO4217CurrencyCode } from '../../../common/validators/is-iso4217-currency-code.validator';

export class UpsertSettlementConfigDto {
  @IsEnum(SettlementSchedule)
  @ApiProperty({ enum: SettlementSchedule, description: 'Payout frequency', example: SettlementSchedule.WEEKLY })
  schedule: SettlementSchedule;

  @IsString()
  @IsNotEmpty()
  @IsISO4217CurrencyCode({ supportedOnly: true })
  @ApiProperty({ description: 'Settlement currency', example: 'USD' })
  currency: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  @Max(50)
  @ApiPropertyOptional({ description: 'Reserve percentage (0-50) to hold from each settlement', example: 10, minimum: 0, maximum: 50 })
  reservePercent?: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(180)
  @ApiPropertyOptional({ description: 'Number of days to hold the reserve (1-180)', example: 30, minimum: 1, maximum: 180 })
  reserveDays?: number;
}
