import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateReportSubscriptionDto } from './create-report-subscription.dto';

export class UpdateReportSubscriptionDto extends PartialType(
  CreateReportSubscriptionDto,
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
