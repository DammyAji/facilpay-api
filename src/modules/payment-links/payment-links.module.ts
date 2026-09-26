import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from '../logger/logger.module';
import { PaymentLink } from './payment-link.entity';
import { PaymentLinkEvent } from './entities/payment-link-event.entity';
import { PaymentLinksService } from './payment-links.service';
import { PaymentLinksController } from './payment-links.controller';

@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    TypeOrmModule.forFeature([PaymentLink, PaymentLinkEvent]),
  ],
  controllers: [PaymentLinksController],
  providers: [PaymentLinksService],
  exports: [PaymentLinksService],
})
export class PaymentLinksModule {}
