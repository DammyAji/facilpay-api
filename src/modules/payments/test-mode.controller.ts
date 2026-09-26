import {
  Controller,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  ForbiddenException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiOkResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { PaymentsService } from './payments.service';
import { SimulatePaymentDto } from './dto/simulate-payment.dto';
import { TestnetOnlyGuard } from './guards/testnet-only.guard';
import { Payment } from './payment.entity';

@ApiTags('test-mode')
@ApiBearerAuth('bearer')
@UseGuards(TestnetOnlyGuard, JwtAuthGuard)
@Controller('v1/test')
export class TestModeController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('payments/:id/simulate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Simulate a payment outcome (testnet only)',
    description:
      'Forces a PENDING payment into COMPLETED, FAILED, EXPIRED, or PARTIALLY_COMPLETED. ' +
      'Triggers the same webhooks, emails, and split processing as a real transaction. ' +
      'Payment is stamped with `metadata.simulated = "true"`. ' +
      'Returns 404 on mainnet (STELLAR_NETWORK=PUBLIC).',
  })
  @ApiParam({ name: 'id', description: 'Payment UUID' })
  @ApiOkResponse({ type: Payment, description: 'Payment after simulation.' })
  @ApiNotFoundResponse({ description: 'Payment not found or endpoint unavailable on mainnet.' })
  @ApiForbiddenResponse({ description: 'Payment does not belong to the authenticated user.' })
  async simulate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SimulatePaymentDto,
    @CurrentUser() user: User,
  ): Promise<Payment> {
    // Ownership check: merchant can only simulate their own payments
    const payment = await this.paymentsService.findOne(id);
    if (payment.merchantId && payment.merchantId !== user.id) {
      throw new ForbiddenException(
        'You do not have permission to simulate this payment',
      );
    }

    return this.paymentsService.simulate(id, dto.outcome, dto.amount);
  }
}
