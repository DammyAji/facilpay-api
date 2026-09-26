import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
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

  @IsUUID()
  @IsOptional()
  @ApiPropertyOptional({ description: 'Verified payout destination for this currency' })
  destinationId?: string;
}
