import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyPayoutDestinationDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}