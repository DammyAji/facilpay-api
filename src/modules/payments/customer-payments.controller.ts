import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetPaymentsDto } from './dto/get-payments.dto';
import { PaymentsService } from './payments.service';

@ApiTags('customers')
@Controller('v1/customers')
export class CustomerPaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get(':id/payments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'List a customer\'s payment history',
    description:
      'Returns the authenticated merchant\'s payments for this customer with payment summary totals grouped by currency.',
  })
  @ApiParam({ name: 'id', description: 'Customer ID' })
  findCustomerPayments(
    @Param('id') customerId: string,
    @Query() query: GetPaymentsDto,
    @Req() request: Request & { user: { id: string } },
  ) {
    if (query.from && query.to) {
      const fromTime = new Date(query.from).getTime();
      const toTime = new Date(query.to).getTime();
      if (fromTime > toTime) {
        throw new BadRequestException(
          'from date must not be greater than to date',
        );
      }
    }

    return this.paymentsService.findCustomerPayments(
      customerId,
      request.user.id,
      query,
    );
  }
}