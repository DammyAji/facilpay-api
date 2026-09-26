import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Event } from './entities/event.entity';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Event])],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {
  constructor(private readonly eventsService: EventsService) {
    // Clean old events on startup and schedule daily cleanup
    this.eventsService.cleanOldEvents().catch(() => {});
  }
}