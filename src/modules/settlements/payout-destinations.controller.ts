import {
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  Body,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreatePayoutDestinationDto } from './dto/create-payout-destination.dto';
import { VerifyPayoutDestinationDto } from './dto/verify-payout-destination.dto';
import { SettlementsService } from './settlements.service';

@ApiTags('payout destinations')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller('v1/settlements/destinations')
export class PayoutDestinationsController {
  constructor(private readonly settlementsService: SettlementsService) {}

  @Get()
  @ApiOperation({ summary: 'List payout destinations' })
  list(@Req() req: Request & { user: { id: string } }) {
    return this.settlementsService.listPayoutDestinations(req.user.id);
  }

  @Post()
  @ApiOperation({
    summary: 'Add a payout destination',
    description:
      'Requires a valid X-Step-Up-Token. The destination remains unusable until email verification and a 24-hour cooling-off period have completed.',
  })
  @ApiBody({ type: CreatePayoutDestinationDto })
  create(
    @Body() dto: CreatePayoutDestinationDto,
    @Headers('x-step-up-token') stepUpToken: string,
    @Req() req: Request & { user: { id: string } },
  ) {
    return this.settlementsService.createPayoutDestination(
      req.user.id,
      dto,
      stepUpToken,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Change a payout destination',
    description:
      'Requires a valid X-Step-Up-Token. Changing the address requires email verification and starts a new 24-hour cooling-off period.',
  })
  @ApiBody({ type: CreatePayoutDestinationDto })
  update(
    @Param('id') id: string,
    @Body() dto: CreatePayoutDestinationDto,
    @Headers('x-step-up-token') stepUpToken: string,
    @Req() req: Request & { user: { id: string } },
  ) {
    return this.settlementsService.updatePayoutDestination(
      req.user.id,
      id,
      dto,
      stepUpToken,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Post(':id/verify')
  @ApiOperation({ summary: 'Verify a payout destination by email token' })
  verify(
    @Param('id') id: string,
    @Body() dto: VerifyPayoutDestinationDto,
    @Req() req: Request & { user: { id: string } },
  ) {
    return this.settlementsService.verifyPayoutDestination(req.user.id, id, dto);
  }

  @Get(':id/verify')
  @ApiOperation({ summary: 'Verify a payout destination from the email link' })
  verifyFromEmail(
    @Param('id') id: string,
    @Query('token') token: string,
    @Req() req: Request & { user: { id: string } },
  ) {
    return this.settlementsService.verifyPayoutDestination(req.user.id, id, { token });
  }
}