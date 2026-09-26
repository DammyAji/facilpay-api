import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsDateString, IsIn, IsUUID } from 'class-validator';

export class GetAnalyticsDto {
  @ApiPropertyOptional({
    description: 'Start date (ISO 8601)',
    example: '2026-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'End date (ISO 8601)',
    example: '2026-01-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    description: 'Analytics interval',
    enum: ['day', 'week'],
    default: 'day',
  })
  @IsOptional()
  @IsIn(['day', 'week'])
  interval?: 'day' | 'week' = 'day';
}

export class AnalyticsBucketDto {
  @ApiProperty({ description: 'Date/time bucket' })
  date: string;

  @ApiProperty({ description: 'Number of views' })
  views: number;

  @ApiProperty({ description: 'Number of redemptions' })
  redemptions: number;

  @ApiProperty({ description: 'Number of completions' })
  completions: number;

  @ApiProperty({ description: 'Conversion rate (0-1)' })
  conversionRate: number;

  @ApiProperty({ description: 'Total revenue in smallest currency unit' })
  revenue: number;
}

export class AnalyticsResponseDto {
  @ApiProperty({ description: 'Payment link ID' })
  linkId: string;

  @ApiProperty({ description: 'Total analytics' })
  total: {
    views: number;
    redemptions: number;
    completions: number;
    conversionRate: number;
    revenue: number;
  };

  @ApiProperty({ description: 'Analytics buckets by time interval', type: [AnalyticsBucketDto] })
  buckets: AnalyticsBucketDto[];
}