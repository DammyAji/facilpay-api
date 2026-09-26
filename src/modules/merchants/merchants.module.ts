import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { MerchantsService } from './merchants.service';
import { MerchantsController } from './merchants.controller';
import { MerchantGeoRestriction } from './entities/merchant-geo-restriction.entity';
import { MerchantIpAllowlist } from './entities/merchant-ip-allowlist.entity';
import { MerchantOnboarding } from '../onboarding/merchant-onboarding.entity';
import { GeoLookupService } from './geo-lookup.service';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([MerchantGeoRestriction, MerchantIpAllowlist, MerchantOnboarding]),
    AuditLogsModule,
  ],
  controllers: [MerchantsController],
  providers: [MerchantsService, GeoLookupService],
  exports: [MerchantsService],
})
export class MerchantsModule {}
