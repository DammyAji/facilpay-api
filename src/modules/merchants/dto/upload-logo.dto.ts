import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class UploadLogoDto {
  @ApiProperty({ description: 'Logo file (PNG or SVG, max 500KB)' })
  @IsNotEmpty()
  file: Express.Multer.File;
}

export class UploadLogoResponseDto {
  @ApiProperty({ description: 'URL to the uploaded logo' })
  logoUrl: string;
}