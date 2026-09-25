import { Controller, Get, Post, Patch, Query, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { SettlementsService } from './settlements.service';
import { GetSettlementsDto } from './dto/get-settlements.dto';
import { UpsertSettlementConfigDto } from './dto/upsert-settlement-config.dto';
import { SetMerchantReserveConfigDto, GetMerchantReserveConfigQueryDto, MerchantReserveConfigResponseDto } from './dto/admin-reserve-config.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/constants/roles';

@ApiTags('admin')
@Controller('v1/admin/settlements')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth('bearer')
export class AdminSettlementsController {
  constructor(private readonly service: SettlementsService) {}

  @Patch('config')
  @ApiOperation({
    summary: 'Update settlement config for a merchant (admin)',
    description: 'Admin-only endpoint. Updates settlement schedule and reserve settings for a merchant.',
  })
  @ApiOkResponse({ description: 'Config updated.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'Admin role required.' })
  updateSettlementConfig(
    @Body() dto: UpsertSettlementConfigDto & { merchantId: string },
  ) {
    return this.service.upsertConfig(dto.merchantId, dto);
  }

  @Get('reserve-config')
  @ApiOperation({
    summary: 'Get reserve config for a merchant (admin)',
    description: 'Admin-only endpoint. Returns the reserve configuration for a merchant.',
  })
  @ApiQuery({ name: 'merchantId', required: true, description: 'Merchant ID' })
  @ApiQuery({ name: 'currency', required: true, description: 'Currency code' })
  @ApiOkResponse({ description: 'Reserve config.', type: MerchantReserveConfigResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'Admin role required.' })
  async getReserveConfig(
    @Query() query: GetMerchantReserveConfigQueryDto,
  ): Promise<MerchantReserveConfigResponseDto | null> {
    const config = await this.service.getReserveConfig(query.merchantId, query.currency);
    if (!config) return null;
    return {
      merchantId: query.merchantId,
      currency: query.currency,
      ...config,
    };
  }

  @Post('reserve-config')
  @ApiOperation({
    summary: 'Set reserve config for a merchant (admin)',
    description: 'Admin-only endpoint. Sets the reserve percentage and days for a merchant to hold back from settlements.',
  })
  @ApiOkResponse({ description: 'Reserve config set.', type: MerchantReserveConfigResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'Admin role required.' })
  async setReserveConfig(
    @Body() dto: SetMerchantReserveConfigDto,
  ): Promise<MerchantReserveConfigResponseDto> {
    await this.service.upsertConfig(dto.merchantId, {
      currency: 'USD', // Default - will be overridden
      schedule: null as any, // Keep existing
      reservePercent: dto.reservePercent,
      reserveDays: dto.reserveDays,
    });
    const config = await this.service.getReserveConfig(dto.merchantId, 'USD');
    return {
      merchantId: dto.merchantId,
      currency: 'USD',
      reservePercent: dto.reservePercent,
      reserveDays: dto.reserveDays,
      totalReservedAmount: config?.totalReservedAmount || 0,
    };
  }

  @Get()
  @ApiOperation({
    summary: 'List all settlements (admin)',
    description: 'Admin-only endpoint. Returns paginated settlements across all merchants with optional date filtering and optional merchant ID filtering.',
  })
  @ApiQuery({ name: 'merchantId', required: false, description: 'Filter by merchant ID (UUID)' })
  @ApiQuery({ name: 'from', required: false, description: 'Start date filter (ISO 8601)' })
  @ApiQuery({ name: 'to', required: false, description: 'End date filter (ISO 8601)' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page (default: 20, max: 100)' })
  @ApiOkResponse({ description: 'Paginated settlement list.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'Admin role required.' })
  findAll(@Query() dto?: GetSettlementsDto) {
    return this.service.findAllSettlements(dto);
  }

  @Post('run')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Manually trigger a settlement run',
    description:
      'Admin-only endpoint. Triggers an out-of-band settlement run for all merchants with a configured settlement schedule (or a single merchant if merchantId is provided), independent of the regular cron schedule. Returns a summary of the settlement batches created.',
  })
  @ApiQuery({
    name: 'merchantId',
    required: false,
    description: 'Optional merchant ID to restrict settlement run to a single merchant. If not provided, runs for all merchants.',
  })
  @ApiOkResponse({
    description: 'Settlement run summary.',
    schema: {
      example: {
        settlementsCreated: 2,
        totalAmount: 1523.75,
        settlements: [],
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'Admin role required.' })
  runSettlements(@Query('merchantId') merchantId?: string) {
    return this.service.triggerManualRun(merchantId);
  }
}
