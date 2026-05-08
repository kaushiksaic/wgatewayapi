import { Injectable } from '@nestjs/common';
import * as sql from 'mssql'
import axios from 'axios';
import { SendMessageDto } from './dto/send-message.dto';
import { RabbitService } from 'src/rabbit/rabbit.service';

@Injectable()
export class MessagesService {

  constructor (private rabbitService: RabbitService){}

    async sendMessage(sendMessageDto: SendMessageDto){
        const pool = await sql.connect();

        try{
            const templateResult = await pool.request()
            .input('TemplateName',sql.VarChar,sendMessageDto.templateName)
            .query(`
                  SELECT
            TemplateId,
            TemplateName,
            LanguageCode,
            MetaStatus
          FROM MessageTemplates
          WHERE TemplateName = @TemplateName
                `);

                if(templateResult.recordset.length === 0){
                    return{
                        success: false,
                        message: 'Template Not Found'
                    };
                }

                const template = templateResult.recordset[0];

                // Step 2: Validate Partner Template Mapping
const mappingResult = await pool
  .request()
  .input(
    'PartnerId',
    sql.BigInt,
    sendMessageDto.partnerId,
  )
  .input(
    'TemplateId',
    sql.BigInt,
    template.TemplateId,
  )
  .query(`
    SELECT MappingId
    FROM PartnerTemplateMapping
    WHERE PartnerId = @PartnerId
      AND TemplateId = @TemplateId
      AND IsEnabled = 1
  `);

if (mappingResult.recordset.length === 0) {
  return {
    success: false,
    message:
      'Template is not mapped to this partner. Please map template before sending.',
  };
}

                if(template.MetaStatus !== 'APPROVED'){
                    return {
                        success: false,
                        message: 'Template is not approved'
                    }
                }

                const variableResult = await pool
        .request()
        .input(
          'TemplateId',
          sql.BigInt,
          template.TemplateId,
        )
        .query(`
          SELECT
            VariableName,
            VariableOrder
          FROM TemplateVariables
          WHERE TemplateId = @TemplateId
          ORDER BY VariableOrder ASC
        `);

        const orderedParameters = variableResult.recordset.map((item) => ({
            type: 'text',
            text: sendMessageDto.parameters[item.VariableName] || '',
        }))


        const payload = {
        messaging_product: 'whatsapp',
        to: sendMessageDto.to,
        type: 'template',
        template: {
          name: template.TemplateName,
          language: {
            code: template.LanguageCode,
          },
          components: [
            {
              type: 'body',
              parameters: orderedParameters,
            },
          ],
        },
      };

      console.log(
        'SEND MESSAGE PAYLOAD:',
        JSON.stringify(payload, null, 2),
      );


      const queueInsertResult = await pool
  .request()
  .input(
    'PartnerId',
    sql.BigInt,
    sendMessageDto.partnerId,
  )
  .input(
    'TemplateId',
    sql.BigInt,
    template.TemplateId,
  )
 
  .input(
    'RecipientMobile',
    sql.VarChar,
    sendMessageDto.to,
  )
  .input(
    'ParameterJson',
    sql.NVarChar(sql.MAX),
    JSON.stringify(sendMessageDto.parameters),
  )
  .query(`
    INSERT INTO MessageQueueLog
    (
      PartnerId,
      TemplateId,
      ReferenceId,
      RecipientMobile,
      TriggerSource,
      RequestedBy,
      ParameterJson,
      QueueStatus,
      CreatedAt
    )
    OUTPUT INSERTED.QueueId
    VALUES
    (
      @PartnerId,
      @TemplateId,
      1,
      @RecipientMobile,
      'ERP',
      'SYSTEM',
      @ParameterJson,
      'PENDING',
      GETDATE()
    )
  `);

const queueId =
  queueInsertResult.recordset[0].QueueId;

      // const response = await axios.post(`https://graph.facebook.com/v25.0/1168935309625406/messages`,payload,{
      //   headers:{
      //       Authorization: `Bearer EAAXqOE6X4bMBRYp5yWWyO9jWy8hN7Q1jhydqxawDVAS2Mqtb4qRqDXop3DHRjaojHWqWpXIO9eruARWNj2PhCEM7J6dSB0FLEPDzQpBHFpXBnm3Sv1udJ7IVSRE0EWAomC2PmHzJ3lYuSY4ZBqnioGbBnaQGHruhjsZCMQxl2EiJ57ZAUeoxeP3XtN4DQZDZD`,
      //       'Content-Type': 'Application/JSON'
      //   }
      // })

      await this.rabbitService.publish({
        queueId,
        partnerId: sendMessageDto.partnerId,
        templateId: template.TemplateId,
        templateName: template.TemplateName,
        languageCode: template.LanguageCode,
        recipientMobile: sendMessageDto.to,
        parameters: sendMessageDto.parameters
      })

      return {
  success: true,
  message: 'Message added to queue successfully',
  queueId,
};
        } catch(error){
            console.error(error);

            return {
                success: false,
                message: 'Message sending field',
                error: 
                error instanceof Error
                ? error.message
                : 'Unknown error message'
            }
        }
    }
}
