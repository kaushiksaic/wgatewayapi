import { Injectable,OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib'
import * as sql from 'mssql'
import axios from 'axios'
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ConsumerService implements OnModuleInit {
constructor(
  private configService:ConfigService
){}


    private readonly queueName = 'whatsapp_message_queue';

    async onModuleInit() {
        const connection = await amqp.connect(
            'amqp://guest:guest@localhost:5672'
        );

        const channel = await connection.createChannel();

        await channel.assertQueue(
            this.queueName,{durable:true}
        );
        console.log('consumer waiting for messages....');
        channel.prefetch(1)
        channel.consume(
            this.queueName,
            async(msg) => {
              try{
                if(!msg) return;

                const data = JSON.parse(msg.content.toString())

                console.log('consumed message:',data)

                 const retryCount =
        msg?.properties.headers?.[
          'x-retry-count'
        ] || 0;

      console.log(
        `Retry Count: ${retryCount}`,
      );
                
                await this.processMessage(data);
                channel.ack(msg);
              } catch (error){
                console.error(
    'Consumer failed:',
    error,
  );

  const retryCount =
        msg?.properties.headers?.[
          'x-retry-count'
        ] || 0;

         if (retryCount < 3) {
        console.log(
          `Retrying message... Attempt ${
            retryCount + 1
          }`,
        );

         channel.sendToQueue(
          this.queueName,
          Buffer.from(
            msg!.content.toString(),
          ),
          {
            persistent: true,
            headers: {
              'x-retry-count':
                retryCount + 1,
            },
          },
        );
                 channel.ack(msg!);
              }else {
                 console.log(
          'Max retries reached. Marking as FAILED.',
        );
         
        
         channel.nack(
          msg!,
          false,
          false,
        );
              }
            }
            },{noAck:false}
        )
    }

     async processMessage(data: any) {
    const pool = await sql.connect();

    try {
      /**
       * STEP 1
       * Update QueueStatus = PROCESSING
       */
      await pool
        .request()
        .input(
          'QueueId',
          sql.BigInt,
          data.queueId,
        )
        .query(`
          UPDATE MessageQueueLog
          SET
            QueueStatus = 'PROCESSING',
            LastAttemptAt = GETDATE()
          WHERE QueueId = @QueueId
        `);

      /**
       * STEP 2
       * Fetch template variables
       */
      const variableResult = await pool
        .request()
        .input(
          'TemplateId',
          sql.BigInt,
          data.templateId,
        )
        .query(`
          SELECT
            VariableName,
            VariableOrder
          FROM TemplateVariables
          WHERE TemplateId = @TemplateId
          ORDER BY VariableOrder ASC
        `);

      const orderedParameters =
        variableResult.recordset.map(
          (item) => ({
            type: 'text',
            text:
              data.parameters[
                item.VariableName
              ] || '',
          }),
        );

      /**
       * STEP 3
       * Build Meta Payload
       */
      const payload = {
        messaging_product: 'whatsapp',
        to: data.recipientMobile,
        type: 'template',
        template: {
          name: data.templateName,
          language: {
            code: data.languageCode,
          },
          components: [
            {
              type: 'body',
              parameters:
                orderedParameters,
            },
          ],
        },
      };

      /**
       * STEP 4
       * Call Meta API
       */
      const PHONE_NUMBER_ID = this.configService.get<string>('PHONE_NUMBER_ID')
      const META_ACCESS_TOKEN = this.configService.get<string>('META_ACCESS_TOKEN')
      const response = await axios.post(
        `https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
        payload,
        {
          headers: {
            Authorization:
              `Bearer ${META_ACCESS_TOKEN}`,
            'Content-Type':
              'application/json',
          },
        },
      );

      const metaMessageId =
        response.data.messages?.[0]?.id;

      /**
       * STEP 5
       * Save MessageSendLog
       */
      await pool
        .request()
        .input(
          'QueueId',
          sql.BigInt,
          data.queueId,
        )
        .input(
          'PartnerId',
          sql.BigInt,
          data.partnerId,
        )
        .input(
          'TemplateId',
          sql.BigInt,
          data.templateId,
        )
        .input(
          'MetaMessageId',
          sql.VarChar,
          metaMessageId,
        )
        .input(
          'ApiRequestPayload',
          sql.NVarChar(sql.MAX),
          JSON.stringify(payload),
        )
        .input(
          'ApiResponsePayload',
          sql.NVarChar(sql.MAX),
          JSON.stringify(response.data),
        )
        .query(`
          INSERT INTO MessageSendLog
          (
            QueueId,
            PartnerId,
            TemplateId,
            MetaMessageId,
            ApiRequestPayload,
            ApiResponsePayload,
            ApiStatus,
            SentAt
          )
          VALUES
          (
            @QueueId,
            @PartnerId,
            @TemplateId,
            @MetaMessageId,
            @ApiRequestPayload,
            @ApiResponsePayload,
            'SUCCESS',
            GETDATE()
          )
        `);

      /**
       * STEP 6
       * Update QueueStatus = SENT
       */
      await pool
        .request()
        .input(
          'QueueId',
          sql.BigInt,
          data.queueId,
        )
        .query(`
          UPDATE MessageQueueLog
          SET
            QueueStatus = 'SENT',
            UpdatedAt = GETDATE()
          WHERE QueueId = @QueueId
        `);

      console.log(
        'Message Sent Successfully',
      );
    } catch (error) {
      console.error(
    'META ERROR RESPONSE:',
    error?.response?.data,
  );
      console.error(
        'Consumer Error:',
        error,
      );
    }
  }
}
