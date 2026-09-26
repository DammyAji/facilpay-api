import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { MerchantsService } from './merchants.service';
import { MerchantsController } from './merchants.controller';
import { MerchantGeoRestriction } from './entities/merchant-geo-restriction.entity';
import { MerchantIpAllowlist } from './entities/merchant-ip-allowlist.entity';
import { MerchantBranding } from './entities/merchant-branding.entity';
import { MerchantSettings } from './entities/merchant-settings.entity';
import { GeoLookupService } from './geo-lookup.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      MerchantGeoRestriction,
      MerchantIpAllowlist,
      MerchantBranding,
      MerchantSettings,
    ]),
    MulterModule.register({
      limits: {
        fileSize: 512000, // 500KB
      },
      fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/png', 'image/svg+xml'];
        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Only PNG and SVG files are allowed'), false);
        }
      },
    }),
  ],
  controllers: [MerchantsController],
  providers: [MerchantsService, GeoLookupService],
  exports: [MerchantsService],
})
export class MerchantsModule {}
