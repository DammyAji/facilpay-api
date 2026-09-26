import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsISO8601,
  IsOptional,
} from 'class-validator';
import { WEBHOOK_EVENT_TYPES } from '../entities/webhook-endpoint.entity';

export class ReplayWebhooksDto {
  @ApiProperty({ description: 'Inclusive start of the replay window' })
  @IsISO8601()
  from: string;

  @ApiProperty({ description: 'Inclusive end of the replay window' })
  @IsISO8601()
  to: string;

  @ApiPropertyOptional({
    description: 'Limit replay to these event types; omit to replay all types',
    enum: WEBHOOK_EVENT_TYPES,
    isArray: true,
  })
  @IsArray()
  @ArrayUnique()
  @IsIn(WEBHOOK_EVENT_TYPES, { each: true })
  @IsOptional()
  eventTypes?: string[];
}