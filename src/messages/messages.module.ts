import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { RabbitModule } from 'src/rabbit/rabbit.module';

@Module({
  imports: [RabbitModule, AuthModule],
  controllers: [MessagesController],
  providers: [MessagesService]
})
export class MessagesModule {}
