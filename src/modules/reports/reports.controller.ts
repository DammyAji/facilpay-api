import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNoContentResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { ReportsService } from './reports.service';
import { CreateReportSubscriptionDto } from './dto/create-report-subscription.dto';
import { UpdateReportSubscriptionDto } from './dto/update-report-subscription.dto';

@ApiTags('reports')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller('v1/reports/subscriptions')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a report subscription' })
  @ApiCreatedResponse({ description: 'Subscription created.' })
  @ApiBadRequestResponse({ description: 'Validation error.' })
  create(
    @CurrentUser() user: User,
    @Body() dto: CreateReportSubscriptionDto,
  ) {
    return this.reportsService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List report subscriptions for the authenticated merchant' })
  @ApiOkResponse({ description: 'List of subscriptions.' })
  findAll(@CurrentUser() user: User) {
    return this.reportsService.findAllForMerchant(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single report subscription' })
  @ApiOkResponse({ description: 'Subscription found.' })
  @ApiNotFoundResponse({ description: 'Not found.' })
  findOne(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reportsService.findOne(id, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a report subscription' })
  @ApiOkResponse({ description: 'Subscription updated.' })
  @ApiNotFoundResponse({ description: 'Not found.' })
  update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReportSubscriptionDto,
  ) {
    return this.reportsService.update(id, user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a report subscription' })
  @ApiNoContentResponse({ description: 'Deleted.' })
  @ApiNotFoundResponse({ description: 'Not found.' })
  remove(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reportsService.remove(id, user.id);
  }
}
