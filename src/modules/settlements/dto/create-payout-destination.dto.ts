import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePayoutDestinationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @ApiProperty({ example: 'Primary USD wallet' })
  label: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(56)
  @ApiProperty({ example: 'GABC...XYZ' })
  stellarAddress: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(12)
  @ApiProperty({ example: 'USDC' })
  assetCode: string;

  @IsBoolean()
  @IsOptional()
  @ApiPropertyOptional({ default: false })
  isDefault?: boolean;
}