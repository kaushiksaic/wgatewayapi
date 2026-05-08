import { Module } from '@nestjs/common';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { RabbitModule } from 'src/rabbit/rabbit.module';

@Module({
  imports: [RabbitModule],
  controllers: [MessagesController],
  providers: [MessagesService]
})
export class MessagesModule {}
