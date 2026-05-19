import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TemplatesModule } from './templates/templates.module';
import { MessagesModule } from './messages/messages.module';
import { AuthModule } from './auth/auth.module';
import { DatabaseService } from './config/database/database.service';
import {ConfigModule} from '@nestjs/config'
import { WebhooksModule } from './webhooks/webhooks.module';
import { RabbitModule } from './rabbit/rabbit.module';
import { PartnersModule } from './partners/partners.module';
import { WalletModule } from './wallet/wallet.module';


@Module({
  imports: [TemplatesModule, MessagesModule, AuthModule, PartnersModule, ConfigModule.forRoot({isGlobal:true}), WebhooksModule, RabbitModule, WalletModule],
  controllers: [AppController],
  providers: [AppService, DatabaseService],
})
export class AppModule {}
