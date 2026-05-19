import { Injectable } from '@nestjs/common';
import * as sql from 'mssql'
import axios from 'axios';
import { SendMessageDto } from './dto/send-message.dto';
import { RabbitService } from 'src/rabbit/rabbit.service';
import { SendBulkMessageDto } from './dto/send-bulk-message.dto';

@Injectable()
export class MessagesService {

  constructor (private rabbitService: RabbitService){}

    async sendMessage(sendMessageDto: SendMessageDto){
        const pool = await sql.connect();

        try{
         const partnerResult = await pool
  .request()
  .input(
    'ErpPartnerId',
    sql.BigInt,
    sendMessageDto.erpPartnerId
  )
  .query(`
    SELECT GatewayPartnerId
    FROM PartnerExternalMapping
    WHERE ErpPartnerId = @ErpPartnerId
      AND IsActive = 1
  `);
if (partnerResult.recordset.length === 0) {
  return {
    success: false,
    message: 'Partner mapping not found'
  };
}
const gatewayPartnerId =
  partnerResult.recordset[0].GatewayPartnerId;
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
          AND IsActive = 1
                `);

                if(templateResult.recordset.length === 0){
                    return{
                        success: false,
                        message: 'Template Not Found'
                    };
                }

                const template = templateResult.recordset[0];

                console.log({
  gatewayPartnerId,
  templateId: template.TemplateId
});
                // Step 2: Validate Partner Template Mapping
const mappingResult = await pool
  .request()
  .input(
    'PartnerId',
    sql.BigInt,
    gatewayPartnerId,
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
console.log(mappingResult.recordset);

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
    gatewayPartnerId,
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
  .input(
    'ExternalReferenceId',
    sql.VarChar,
    sendMessageDto.externalReferenceId
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
      CreatedAt,
      ExternalReferenceId
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
      GETDATE(),
      @ExternalReferenceId
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
        partnerId: gatewayPartnerId,
        templateId: template.TemplateId,
        templateName: template.TemplateName,
        languageCode: template.LanguageCode,
        recipientMobile: sendMessageDto.to,
        parameters: sendMessageDto.parameters,
        externalReferenceId: sendMessageDto.externalReferenceId
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
    async sendBulkMessage(sendBulkMessageDto:SendBulkMessageDto){
      const pool =  await sql.connect();
      try{
        const partnerResult = await pool
  .request()
  .input(
    'ErpPartnerId',
    sql.BigInt,
    sendBulkMessageDto.erpPartnerId
  )
  .query(`
    SELECT GatewayPartnerId
    FROM PartnerExternalMapping
    WHERE ErpPartnerId = @ErpPartnerId
      AND IsActive = 1
  `);
if (partnerResult.recordset.length === 0) {
  return {
    success: false,
    message: 'Partner mapping not found'
  };
}
const gatewayPartnerId =
  partnerResult.recordset[0].GatewayPartnerId;
        const templateResult = await pool.request()
            .input('TemplateName',sql.VarChar,sendBulkMessageDto.templateName)
            .query(`
                  SELECT
            TemplateId,
            TemplateName,
            LanguageCode,
            MetaStatus
          FROM MessageTemplates
          WHERE TemplateName = @TemplateName
          AND IsActive = 1
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
    gatewayPartnerId,
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
        let successCount = 0;
        let failedCount = 0;
        const queueIds: number[] = [];
        for(const recipient of sendBulkMessageDto.recipients){
          try{
            console.log(
  'RECIPIENT:',
  JSON.stringify(recipient, null, 2)
);
            const queueInsertResult = await pool
  .request()
  .input(
    'PartnerId',
    sql.BigInt,
    gatewayPartnerId,
  )
  .input(
    'TemplateId',
    sql.BigInt,
    template.TemplateId,
  )
  .input(
    'RecipientMobile',
    sql.VarChar,
    recipient.to,
  )
  .input(
    'ParameterJson',
    sql.NVarChar(sql.MAX),
    JSON.stringify(recipient.parameters),
  )
  .input(
    'ExternalReferenceId',
    sql.VarChar,
    recipient.externalReferenceId
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
      CreatedAt,
      ExternalReferenceId
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
      GETDATE(),
      @ExternalReferenceId
    )
  `);
  const queueId = queueInsertResult.recordset[0].QueueId;
   await this.rabbitService.publish({
          queueId,
          partnerId:
            gatewayPartnerId,
          templateId: template.TemplateId,
          templateName:
            template.TemplateName,
          languageCode:
            template.LanguageCode,
          recipientMobile: recipient.to,
          parameters: recipient.parameters,
          externalReferenceId: recipient.externalReferenceId
        });
        queueIds.push(queueId);
         successCount++;
          }catch(error){
             console.error(error);
        failedCount++;
          }
        }
        return {
          success: true,
          message: 'Bulk messages queued successfully',
          successCount,
          failedCount,
          queueIds
        }
      }catch(error){
        return {
      success: false,
      message: 'Bulk send failed',
      error:
        error instanceof Error
          ? error.message
          : 'Unknown error',
    };
      }
    }
    async getMessageStatus(externalReferenceId:string){
      const pool = await sql.connect();
       try {
    const result = await pool
      .request()
      .input(
        'ExternalReferenceId',
        sql.VarChar,
        externalReferenceId
      )
      .query(`
        SELECT TOP 1
          mql.ExternalReferenceId,
          mt.TemplateName,
          mql.RecipientMobile,
          mql.QueueStatus,
          msl.DeliveryStatus,
          msl.ReadTimestamp,
          msl.FailedReason,
          msl.SentAt
        FROM MessageQueueLog mql
        LEFT JOIN MessageSendLog msl
          ON mql.QueueId = msl.QueueId
        LEFT JOIN MessageTemplates mt
          ON mql.TemplateId = mt.TemplateId
        WHERE mql.ExternalReferenceId = @ExternalReferenceId
        ORDER BY mql.QueueId DESC
      `);
    if (result.recordset.length === 0) {
      return {
        success: false,
        message: 'Message not found'
      };
    }
    return {
      success: true,
      data: result.recordset[0]
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to fetch message status',
      error:
        error instanceof Error
          ? error.message
          : 'Unknown error'
    };
    }
}
  async getMessageHistory(gatewayPartnerId?: number) {
    const pool = await sql.connect();
    try {
      const request = pool.request();
      let partnerFilter = '';

      if (gatewayPartnerId !== undefined && !Number.isNaN(gatewayPartnerId)) {
        request.input('GatewayPartnerId', sql.BigInt, gatewayPartnerId);
        partnerFilter = 'WHERE mql.PartnerId = @GatewayPartnerId';
      }

      const result = await request.query(`
        SELECT
          mql.ExternalReferenceId,
          mql.PartnerId,
          p.PartnerName,
          p.PartnerCode,
          mt.TemplateName,
          mql.RecipientMobile,
          mql.QueueStatus,
          msl.DeliveryStatus,
          msl.SentAt
        FROM MessageQueueLog mql
        LEFT JOIN Partners p ON mql.PartnerId = p.PartnerId
        LEFT JOIN MessageSendLog msl ON mql.QueueId = msl.QueueId
        LEFT JOIN MessageTemplates mt ON mql.TemplateId = mt.TemplateId
        ${partnerFilter}
        ORDER BY mql.QueueId DESC
      `);

      return {
        success: true,
        data: result.recordset,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to fetch message history',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /** Legacy: resolve ERP id via PartnerExternalMapping */
  async getMessageHistoryByErp(erpPartnerId: string) {
    const pool = await sql.connect();
    try {
      const mapping = await pool
        .request()
        .input('ErpPartnerId', sql.VarChar, erpPartnerId)
        .query(`
          SELECT GatewayPartnerId
          FROM PartnerExternalMapping
          WHERE ErpPartnerId = @ErpPartnerId AND IsActive = 1
        `);

      if (mapping.recordset.length === 0) {
        return {
          success: false,
          message: 'Partner mapping not found',
        };
      }

      return this.getMessageHistory(
        mapping.recordset[0].GatewayPartnerId,
      );
    } catch (error) {
      return {
        success: false,
        message: 'Failed to fetch message history',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
