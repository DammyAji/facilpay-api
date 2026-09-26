import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Blocks the endpoint with 404 when STELLAR_NETWORK is 'PUBLIC' (mainnet).
 * This makes sandbox/simulation routes completely invisible in production.
 */
@Injectable()
export class TestnetOnlyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(_ctx: ExecutionContext): boolean {
    const network = this.configService.get<string>('STELLAR_NETWORK', 'TESTNET');
    if (network === 'PUBLIC') {
      throw new NotFoundException();
    }
    return true;
  }
}
