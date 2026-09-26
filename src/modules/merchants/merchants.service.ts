import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MerchantGeoRestriction } from './entities/merchant-geo-restriction.entity';
import { MerchantIpAllowlist } from './entities/merchant-ip-allowlist.entity';
import { MerchantBranding } from './entities/merchant-branding.entity';
import { MerchantSettings } from './entities/merchant-settings.entity';
import { UpdateGeoRestrictionsDto } from './dto/update-geo-restrictions.dto';
import { UpdateIpAllowlistDto } from './dto/update-ip-allowlist.dto';
import { UpdateBrandingDto } from './dto/update-branding.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { GeoLookupService } from './geo-lookup.service';
import { GeoRestrictedException } from './geo-restricted.exception';
import { IpAllowlistBlockedException } from './ip-allowlist-blocked.exception';
import { isIpAllowed } from './ip-utils';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { createReadStream, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { Pipeline } from 'stream/promises';
import { Storage } from '@google-cloud/storage';

@Injectable()
export class MerchantsService {
  private readonly storage: Storage;
  private readonly bucketName: string;
  private readonly logoStoragePath = 'branding/logos';

  constructor(
    @InjectRepository(MerchantGeoRestriction)
    private readonly geoRestrictionRepo: Repository<MerchantGeoRestriction>,
    @InjectRepository(MerchantIpAllowlist)
    private readonly ipAllowlistRepo: Repository<MerchantIpAllowlist>,
    @InjectRepository(MerchantBranding)
    private readonly brandingRepo: Repository<MerchantBranding>,
    @InjectRepository(MerchantSettings)
    private readonly settingsRepo: Repository<MerchantSettings>,
    private readonly geoLookupService: GeoLookupService,
    private readonly configService: ConfigService,
  ) {
    // Initialize Google Cloud Storage if credentials are provided
    const keyFilename = this.configService.get('GOOGLE_APPLICATION_CREDENTIALS');
    if (keyFilename) {
      this.storage = new Storage({ keyFilename });
      this.bucketName = this.configService.get('GCS_BUCKET_NAME', 'facilpay-assets');
    } else {
      this.storage = new Storage();
      this.bucketName = this.configService.get('GCS_BUCKET_NAME', 'facilpay-assets');
    }
  }

  /**
   * Get branding with fallback to defaults
   */
  async getBranding(merchantId: string): Promise<MerchantBranding | null> {
    return this.brandingRepo.findOneBy({ merchantId });
  }

  /**
   * Get branding with FacilPay defaults fallback
   */
  async getBrandingWithDefaults(merchantId: string): Promise<{
    displayName: string;
    logo: string | null;
    primaryColor: string;
    supportEmail: string | null;
    supportUrl: string | null;
  }> {
    const branding = await this.getBranding(merchantId);
    
    return {
      displayName: branding?.displayName ?? 'FacilPay',
      logo: branding?.logo ?? null,
      primaryColor: branding?.primaryColor ?? '#1a1a2e',
      supportEmail: branding?.supportEmail ?? this.configService.get('DEFAULT_SUPPORT_EMAIL', 'support@facilpay.com'),
      supportUrl: branding?.supportUrl ?? this.configService.get('DEFAULT_SUPPORT_URL', 'https://facilpay.com'),
    };
  }

  /**
   * Upsert merchant branding
   */
  async upsertBranding(merchantId: string, dto: UpdateBrandingDto): Promise<MerchantBranding> {
    let branding = await this.brandingRepo.findOneBy({ merchantId });
    if (!branding) {
      branding = this.brandingRepo.create({ merchantId });
    }

    if (dto.displayName !== undefined) branding.displayName = dto.displayName;
    if (dto.primaryColor !== undefined) branding.primaryColor = dto.primaryColor;
    if (dto.supportEmail !== undefined) branding.supportEmail = dto.supportEmail;
    if (dto.supportUrl !== undefined) branding.supportUrl = dto.supportUrl;

    return this.brandingRepo.save(branding);
  }

  /**
   * Upload merchant logo
   * Validates: PNG/SVG, max 500KB
   */
  async uploadLogo(merchantId: string, file: Express.Multer.File): Promise<{ logoUrl: string }> {
    // Validate file type
    const allowedTypes = ['image/png', 'image/svg+xml'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException('Logo must be PNG or SVG format');
    }

    // Validate file size (500KB = 512000 bytes)
    const maxSize = 512000;
    if (file.size > maxSize) {
      throw new BadRequestException('Logo must be 500KB or less');
    }

    // Generate unique filename
    const ext = file.mimetype === 'image/svg+xml' ? 'svg' : 'png';
    const filename = `${merchantId}-${randomBytes(16).toString('hex')}.${ext}`;
    const gcsPath = `${this.logoStoragePath}/${filename}`;

    try {
      const bucket = this.storage.bucket(this.bucketName);
      const gcsFile = bucket.file(gcsPath);

      // Upload to Google Cloud Storage
      await gcsFile.save(file.buffer, {
        contentType: file.mimetype,
        metadata: {
          cacheControl: 'public, max-age=31536000',
        },
      });

      // Make the file publicly accessible
      await gcsFile.makePublic();

      const logoUrl = `https://storage.googleapis.com/${this.bucketName}/${gcsPath}`;

      // Update branding record with logo URL
      let branding = await this.brandingRepo.findOneBy({ merchantId });
      if (!branding) {
        branding = this.brandingRepo.create({ merchantId, logo: logoUrl });
      } else {
        branding.logo = logoUrl;
      }
      await this.brandingRepo.save(branding);

      return { logoUrl };
    } catch (error) {
      // Fallback to local storage if GCS fails
      const uploadDir = join(process.cwd(), 'uploads', this.logoStoragePath);
      if (!existsSync(uploadDir)) {
        mkdirSync(uploadDir, { recursive: true });
      }

      const localPath = join(uploadDir, filename);
      await Pipeline(file.buffer, createReadStream() as any);

      // Write using Node.js fs
      const { writeFileSync } = await import('fs');
      writeFileSync(localPath, file.buffer);

      const logoUrl = `/uploads/${gcsPath}`;
      
      let branding = await this.brandingRepo.findOneBy({ merchantId });
      if (!branding) {
        branding = this.brandingRepo.create({ merchantId, logo: logoUrl });
      } else {
        branding.logo = logoUrl;
      }
      await this.brandingRepo.save(branding);

      return { logoUrl };
    }
  }

  /**
   * Get merchant settings
   */
  async getSettings(merchantId: string): Promise<MerchantSettings | null> {
    return this.settingsRepo.findOneBy({ merchantId });
  }

  /**
   * Get settings with defaults fallback
   */
  async getSettingsWithDefaults(merchantId: string): Promise<{
    remindersEnabled: boolean;
    reminderOffsets: number[];
  }> {
    const settings = await this.getSettings(merchantId);
    
    return {
      remindersEnabled: settings?.remindersEnabled ?? true,
      reminderOffsets: settings?.reminderOffsets ?? [-3, 0, 7],
    };
  }

  /**
   * Upsert merchant settings
   */
  async upsertSettings(merchantId: string, dto: UpdateSettingsDto): Promise<MerchantSettings> {
    let settings = await this.settingsRepo.findOneBy({ merchantId });
    if (!settings) {
      settings = this.settingsRepo.create({ merchantId });
    }

    if (dto.remindersEnabled !== undefined) settings.remindersEnabled = dto.remindersEnabled;
    if (dto.reminderOffsets !== undefined) settings.reminderOffsets = dto.reminderOffsets;

    return this.settingsRepo.save(settings);
  }

  async upsertGeoRestrictions(
    merchantId: string,
    dto: UpdateGeoRestrictionsDto,
  ): Promise<MerchantGeoRestriction> {
    let config = await this.geoRestrictionRepo.findOneBy({ merchantId });
    if (!config) {
      config = this.geoRestrictionRepo.create({ merchantId });
    }

    if (dto.allowedCountries !== undefined) {
      config.allowedCountries = dto.allowedCountries;
    }
    if (dto.blockedCountries !== undefined) {
      config.blockedCountries = dto.blockedCountries;
    }
    if (dto.bypassInTestMode !== undefined) {
      config.bypassInTestMode = dto.bypassInTestMode;
    }

    return this.geoRestrictionRepo.save(config);
  }

  /**
   * Enforces a merchant's geo-restriction config for an incoming payment.
   * No-ops when the merchant has no config or the country cannot be resolved.
   */
  async enforceGeoRestriction(
    merchantId: string | undefined,
    ip: string | undefined,
    isTestMode: boolean,
  ): Promise<void> {
    if (!merchantId || !ip) return;

    const config = await this.geoRestrictionRepo.findOneBy({ merchantId });
    if (!config) return;

    if (isTestMode && config.bypassInTestMode) return;

    const country = this.geoLookupService.lookupCountry(ip);
    if (!country) return;

    const { allowedCountries, blockedCountries } = config;

    if (allowedCountries?.length && !allowedCountries.includes(country)) {
      throw new GeoRestrictedException(
        `Payments from ${country} are not permitted by this merchant`,
      );
    }

    if (blockedCountries?.length && blockedCountries.includes(country)) {
      throw new GeoRestrictedException(
        `Payments from ${country} are not permitted by this merchant`,
      );
    }
  }

  /**
   * Upserts the IP allowlist for a merchant.
   * An empty allowedIps array clears all restrictions.
   */
  async upsertIpAllowlist(
    merchantId: string,
    dto: UpdateIpAllowlistDto,
  ): Promise<MerchantIpAllowlist> {
    let record = await this.ipAllowlistRepo.findOneBy({ merchantId });
    if (!record) {
      record = this.ipAllowlistRepo.create({ merchantId, allowedIps: [] });
    }
    record.allowedIps = dto.allowedIps;
    return this.ipAllowlistRepo.save(record);
  }

  /**
   * Returns the current IP allowlist for a merchant.
   */
  async getIpAllowlist(merchantId: string): Promise<MerchantIpAllowlist | null> {
    return this.ipAllowlistRepo.findOneBy({ merchantId });
  }

  /**
   * Enforces the IP allowlist for a merchant API request.
   * No-ops when the merchant has no allowlist config or the list is empty.
   * Throws IpAllowlistBlockedException (403) when the IP is not allowed.
   */
  async enforceIpAllowlist(
    merchantId: string,
    ip: string | undefined,
  ): Promise<void> {
    if (!ip) return;

    const record = await this.ipAllowlistRepo.findOneBy({ merchantId });
    if (!record || !record.allowedIps?.length) return;

    if (!isIpAllowed(ip, record.allowedIps)) {
      throw new IpAllowlistBlockedException(ip);
    }
  }
}
