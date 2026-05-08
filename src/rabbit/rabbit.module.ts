import { Module } from '@nestjs/common';
import { RabbitService } from './rabbit.service';
import { ConsumerService } from './consumer/consumer.service';

@Module({
  providers: [RabbitService, ConsumerService],
  exports: [RabbitService]
})
export class RabbitModule {}
