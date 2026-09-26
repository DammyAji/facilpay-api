import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaymentsService } from './payments.service';

@ApiTags('refunds')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller('v1/refunds')
export class RefundsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('report')
  @ApiOperation({
    summary: 'Get refund report',
    description:
      'Returns refund counts and amounts grouped by reason code and currency.',
  })
  @ApiQuery({
    name: 'from',
    required: false,
    type: String,
    format: 'date-time',
  })
  @ApiQuery({ name: 'to', required: false, type: String, format: 'date-time' })
  getReport(@Query('from') from?: string, @Query('to') to?: string) {
    const fromDate = this.parseDate(from, 'from');
    const toDate = this.parseDate(to, 'to');

    if (fromDate && toDate && fromDate > toDate) {
      throw new BadRequestException('from must be before or equal to to');
    }

    return this.paymentsService.getRefundReport(
      fromDate?.toISOString(),
      toDate?.toISOString(),
    );
  }

  private parseDate(value: string | undefined, name: string): Date | undefined {
    if (!value) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${name} must be a valid ISO date`);
    }
    return date;
  }
}