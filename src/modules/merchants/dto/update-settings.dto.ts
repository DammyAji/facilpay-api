import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsArray, IsInt, Min, Max, ArrayMinSize, ArrayMaxSize } from 'class-validator';

export class UpdateSettingsDto {
  @ApiPropertyOptional({ description: 'Enable or disable invoice reminders', default: true })
  @IsOptional()
  @IsBoolean()
  remindersEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Days relative to due date to send reminders (negative = before, 0 = on due date, positive = after)',
    example: [-3, 0, 7],
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsInt({ each: true })
  @Min(-30, { each: true })
  @Max(30, { each: true })
  reminderOffsets?: number[];
}