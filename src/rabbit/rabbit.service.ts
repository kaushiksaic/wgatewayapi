import { Injectable, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib'
import { ConfirmChannel, ChannelModel } from 'amqplib';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RabbitService implements OnModuleInit {
constructor(
    private configService:ConfigService
){}

    private channel: ConfirmChannel;
    private connection: ChannelModel;

    private readonly queueName = 'whatsapp_message_queue'

    async onModuleInit() {
        const RABBITMQ_URL = this.configService.get<string>('RABBITMQ_URL')

        if(!RABBITMQ_URL){
            throw new Error(`RABBITMQ_URL is Missing in .env`)
        }
        
        this.connection =  await amqp.connect(RABBITMQ_URL);
        this.channel = await this.connection.createConfirmChannel();

         await this.channel.assertQueue(
      this.queueName,
      {
        durable: true,
      },
    );

     console.log(
      'RabbitMQ Connected Successfully',
    );

    }

    async publish(data:any){
        this.channel.sendToQueue(
            this.queueName,
            Buffer.from(JSON.stringify(data)),
            {
                persistent:true
            },
        );
        console.log('Message Published:',data);
    };

    
}
