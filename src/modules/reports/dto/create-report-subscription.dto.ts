import {
  IsEnum,
  IsArray,
  IsEmail,
  IsBoolean,
  IsOptional,
  IsString,
  ArrayMaxSize,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportFrequency } from '../entities/report-subscription.entity';

export class CreateReportSubscriptionDto {
  @ApiProperty({ enum: ReportFrequency })
  @IsEnum(ReportFrequency)
  frequency: ReportFrequency;

  @ApiProperty({ type: [String], maxItems: 5, example: ['[email protected]'] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsEmail({}, { each: true })
  recipients: string[];

  @ApiPropertyOptional({ default: 'UTC', example: 'America/New_York' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  includeCsv?: boolean;
}
