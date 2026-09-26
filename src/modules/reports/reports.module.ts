import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ReportSubscription } from './entities/report-subscription.entity';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { Payment } from '../payments/payment.entity';
import { Refund } from '../payments/refund.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([ReportSubscription, Payment, Refund]),
    NotificationsModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
