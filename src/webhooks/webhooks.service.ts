import { Injectable } from '@nestjs/common';
import * as sql from 'mssql';

@Injectable()
export class WebhooksService {
  async processWebhook(body: any) {
    const pool = await sql.connect();
    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin();

      console.log(
        'META WEBHOOK:',
        JSON.stringify(body, null, 2),
      );

      const change = body?.entry?.[0]?.changes?.[0];

      if (!change) {
        await transaction.rollback();

        return {
          success: false,
          message: 'Invalid webhook payload',
        };
      }

      const value = change.value;

      const eventType = value.event || 'UNKNOWN';

      const metaMessageId =
        value.message_template_id ||
        value.message_id ||
        null;

      // STEP 1: Save Raw Webhook Log
      const logRequest = new sql.Request(transaction);

      await logRequest
        .input(
          'MetaMessageId',
          sql.VarChar,
          metaMessageId,
        )
        .input(
          'EventType',
          sql.VarChar,
          eventType,
        )
        .input(
          'RawPayload',
          sql.NVarChar(sql.MAX),
          JSON.stringify(body),
        )
        .input(
          'ProcessingStatus',
          sql.VarChar,
          'PENDING',
        )
        .query(`
          INSERT INTO WebhookRawLog
          (
            MetaMessageId,
            EventType,
            RawPayload,
            ProcessingStatus,
            ReceivedAt
          )
          VALUES
          (
            @MetaMessageId,
            @EventType,
            @RawPayload,
            @ProcessingStatus,
            GETDATE()
          )
        `);

      // STEP 2: Process Template Status Updates
      if (
        change.field ===
        'message_template_status_update'
      ) {
        const templateRequest =
          new sql.Request(transaction);

        await templateRequest
          .input(
            'TemplateName',
            sql.VarChar,
            value.message_template_name,
          )
          .input(
            'MetaStatus',
            sql.VarChar,
            value.event,
          )
          .input(
            'RejectionReason',
            sql.NVarChar(sql.MAX),
            value?.rejection_info?.reason || null,
          )
          .input(
            'RejectionRecommendation',
            sql.NVarChar(sql.MAX),
            value?.rejection_info?.recommendation || null,
          )
          .input(
            'WebhookPayload',
            sql.NVarChar(sql.MAX),
            JSON.stringify(body),
          )
          .query(`
            UPDATE MessageTemplates
            SET
              MetaStatus = @MetaStatus,
              RejectionReason = @RejectionReason,
              RejectionRecommendation = @RejectionRecommendation,
              WebhookPayload = @WebhookPayload,
              UpdatedAt = GETDATE()
            WHERE TemplateName = @TemplateName
          `);
      }

      // STEP 3: Mark Webhook as Processed
      const processedRequest =
        new sql.Request(transaction);

      await processedRequest
        .input(
          'MetaMessageId',
          sql.VarChar,
          metaMessageId,
        )
        .query(`
          UPDATE WebhookRawLog
          SET
            ProcessingStatus = 'PROCESSED',
            ProcessedAt = GETDATE()
          WHERE MetaMessageId = @MetaMessageId
            AND ProcessingStatus = 'PENDING'
        `);

      await transaction.commit();

      return {
        success: true,
        message: 'Webhook processed successfully',
      };
    } catch (error) {
      await transaction.rollback();

      console.error(
        'Webhook processing failed:',
        error,
      );

      return {
        success: false,
        message: 'Webhook processing failed',
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred',
      };
    }
  }
}