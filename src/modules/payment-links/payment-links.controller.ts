import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiParam,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { PaymentLinksService } from './payment-links.service';
import { CreatePaymentLinkDto } from './dto/create-payment-link.dto';
import { UpdatePaymentLinkDto } from './dto/update-payment-link.dto';
import { RedeemPaymentLinkDto } from './dto/redeem-payment-link.dto';
import { GetAnalyticsDto, AnalyticsResponseDto } from './dto/get-analytics.dto';
import { PaymentLink } from './payment-link.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('payment-links')
@Controller('v1/payment-links')
@UseGuards(JwtAuthGuard)
export class PaymentLinksController {
  constructor(private readonly service: PaymentLinksService) {}

  @Post()
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Create a payment link',
    description: 'Generates a shareable payment link with a unique token. Optionally set maxCompletions to deactivate the link after that many successful payments.',
  })
  @ApiCreatedResponse({ description: 'Payment link created.', type: PaymentLink })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  create(@Body() dto: CreatePaymentLinkDto, @Request() req: any) {
    return this.service.create(dto, req.user.id);
  }

  @Get()
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'List payment links for the authenticated merchant',
    description: 'Returns a paginated list of payment links belonging to the merchant.',
  })
  @ApiOkResponse({ description: 'Paginated list of payment links.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiQuery({ name: 'page', required: false, example: 1, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, example: 20, description: 'Items per page (max 100)' })
  @ApiQuery({ name: 'sortBy', required: false, example: 'createdAt', description: 'Sort field (createdAt, amount, views, completions, updatedAt)' })
  @ApiQuery({ name: 'order', required: false, enum: ['ASC', 'DESC'], description: 'Sort order' })
  findAll(@Query() pagination: PaginationDto, @Request() req: any) {
    return this.service.findAllByMerchant(req.user.id, pagination);
  }

  @Public()
  @Post(':tokenOrSlug/redeem')
  @ApiOperation({
    summary: 'Redeem a payment link',
    description: 'Validates the link and, for flexible-amount links, requires a payer-supplied amount. Links at their completion limit are deactivated.',
  })
  @ApiParam({ name: 'tokenOrSlug', description: '16-byte hex token or custom slug from the payment link URL' })
  @ApiOkResponse({ description: 'Payment link ready for checkout.' })
  @ApiResponse({ status: 400, description: 'payerAmount missing, below minAmount, or missing required payer fields.' })
  @ApiNotFoundResponse({ description: 'Link not found.' })
  @ApiResponse({ status: 410, description: 'Link expired or deactivated.' })
  redeemLink(@Param('tokenOrSlug') tokenOrSlug: string, @Body() dto: RedeemPaymentLinkDto) {
    return this.service.redeemLink(tokenOrSlug, dto);
  }

  @Public()
  @Get(':tokenOrSlug')
  @ApiOperation({
    summary: 'Retrieve a payment link by token or slug',
    description: 'Public endpoint — no authentication required. Increments view count on each call. Accepts token or slug.',
  })
  @ApiParam({ name: 'tokenOrSlug', description: '16-byte hex token or custom slug from the payment link URL' })
  @ApiOkResponse({ description: 'Payment link details.' })
  @ApiNotFoundResponse({ description: 'Link not found.' })
  @ApiResponse({ status: 410, description: 'Link expired or deactivated.' })
  findByToken(@Param('tokenOrSlug') tokenOrSlug: string) {
    return this.service.findByTokenOrSlug(tokenOrSlug);
  }

  @Patch(':id')
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Update a payment link',
    description: 'Updates editable fields (amount, currency, description, expiresAt, isActive) of an existing payment link. Expired links cannot be reactivated.',
  })
  @ApiParam({ name: 'id', description: 'Payment link UUID' })
  @ApiOkResponse({ description: 'Payment link updated.', type: PaymentLink })
  @ApiNotFoundResponse({ description: 'Link not found.' })
  @ApiResponse({ status: 410, description: 'An expired payment link cannot be reactivated.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePaymentLinkDto,
    @Request() req: any,
  ) {
    return this.service.update(id, req.user.id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Deactivate a payment link',
    description: 'Sets isActive to false. The link will return 410 Gone after deactivation.',
  })
  @ApiParam({ name: 'id', description: 'Payment link UUID' })
  @ApiNoContentResponse({ description: 'Link deactivated.' })
  @ApiNotFoundResponse({ description: 'Link not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  deactivate(@Param('id') id: string, @Request() req: any) {
    return this.service.deactivate(id, req.user.id);
  }

  @Get(':id/analytics')
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Get payment link analytics',
    description: 'Returns detailed analytics for a payment link including views, redemptions, completions over time.',
  })
  @ApiParam({ name: 'id', description: 'Payment link UUID' })
  @ApiOkResponse({ description: 'Analytics data', type: AnalyticsResponseDto })
  @ApiNotFoundResponse({ description: 'Link not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiQuery({ name: 'from', required: false, description: 'Start date (ISO 8601)' })
  @ApiQuery({ name: 'to', required: false, description: 'End date (ISO 8601)' })
  @ApiQuery({ name: 'interval', required: false, enum: ['day', 'week'], description: 'Time interval for bucketing' })
  getAnalytics(
    @Param('id') id: string,
    @Query() dto: GetAnalyticsDto,
    @Request() req: any,
  ) {
    return this.service.getAnalytics(id, req.user.id, dto);
  }
}
