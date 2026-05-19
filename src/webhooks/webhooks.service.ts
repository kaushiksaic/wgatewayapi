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

      const eventType = value.event || change.field || 'UNKNOWN';

      const metaMessageId =
        value.message_template_id ||
        value.message_id ||
        value?.statuses?.[0]?.id ||
        value?.messages?.[0]?.id ||
        null;

        console.log(
  'MetaMessageId:',
  metaMessageId,
  typeof metaMessageId
);
      // STEP 1: Save Raw Webhook Log
      const logRequest = new sql.Request(transaction);

      await logRequest
        .input(
          'MetaMessageId',
          sql.VarChar,
          metaMessageId ? String(metaMessageId) : null,
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
            'Category',
            sql.VarChar,
            value.message_template_category
          )
          .input(
            'MetaTemplateId',
            sql.BigInt,
            value.message_template_id
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
              MetaTemplateId = @MetaTemplateId,
              Category = @Category, 
              RejectionReason = @RejectionReason,
              RejectionRecommendation = @RejectionRecommendation,
              WebhookPayload = @WebhookPayload,
              UpdatedAt = GETDATE()
            WHERE TemplateName = @TemplateName
          `);
      }

      if(change.field === 'template_category_update'){
        const categoryRequest = new sql.Request(transaction);
        await categoryRequest
        .input('TemplateName',sql.VarChar,value.message_template_name)
        .input('PreviousCategory',sql.VarChar,value.previous_category || null)
        .input('NewCategory',sql.VarChar,value.new_category || null)
        .input('WebhookPayload',sql.NVarChar(sql.MAX),JSON.stringify(body))
        .query(`
          UPDATE MessageTemplates
          SET Category = @NewCategory,
          WebhookPayload = @WebhookPayload,
          UpdatedAt = getdate()
          WHERE TemplateName = @TemplateName
          `)
      }
      if (change.field === 'messages') {
  const status = value?.statuses?.[0];
  if (status) {
    await new sql.Request(transaction)
      .input(
        'MetaMessageId',
        sql.VarChar,
        status.id,
      )
      .input(
        'DeliveryStatus',
        sql.VarChar,
        status.status,
      )
      .input(
        'DeliveryTimestamp',
        sql.DateTime,
        status.timestamp
          ? new Date(
              Number(status.timestamp) * 1000,
            )
          : null,
      )
      .input(
        'RecipientWaId',
        sql.VarChar,
        status.recipient_id || null,
      )
      .input(
        'Billable',
        sql.Bit,
        status?.pricing?.billable ?? null,
      )
      .input(
        'PricingCategory',
        sql.VarChar,
        status?.pricing?.category || null,
      )
      .input(
        'ConversationCategory',
        sql.VarChar,
        status?.pricing?.type || null,
      )
      .input(
        'FailedReason',
        sql.NVarChar(sql.MAX),
        status?.errors?.[0]?.title || null,
      )
      .input(
        'StatusWebhookPayload',
        sql.NVarChar(sql.MAX),
        JSON.stringify(body),
      )
      .query(`
        UPDATE MessageSendLog
        SET
          DeliveryStatus = @DeliveryStatus,
          DeliveryTimestamp = @DeliveryTimestamp,
          RecipientWaId = @RecipientWaId,
          Billable = @Billable,
          PricingCategory = @PricingCategory,
          ConversationCategory = @ConversationCategory,
          FailedReason = @FailedReason,
          StatusWebhookPayload = @StatusWebhookPayload,
          UpdatedAt = GETDATE()
        WHERE MetaMessageId = @MetaMessageId
      `);
      if (
  (status.status === 'sent' || status.status === 'delivered' || status.status === 'read') && 
  status?.pricing?.billable === true
) {
  // STEP: Get Queue + Partner + Template details
  const messageResult = await new sql.Request(transaction)
    .input(
      'MetaMessageId',
      sql.VarChar,
      status.id
    )
    .query(`
      SELECT TOP 1
        msl.QueueId,
        msl.SendId,
        mql.PartnerId,
        mql.TemplateId,
        mql.ExternalReferenceId
      FROM MessageSendLog msl
      INNER JOIN MessageQueueLog mql
        ON msl.QueueId = mql.QueueId
      WHERE msl.MetaMessageId = @MetaMessageId
    `);
  if (messageResult.recordset.length > 0) {
    const messageData =
      messageResult.recordset[0];
    // STEP: Fetch Pricing Master
    const pricingResult =
      await new sql.Request(transaction)
        .input(
          'PartnerId',
          sql.BigInt,
          messageData.PartnerId
        )
        .input(
          'ConversationCategory',
          sql.VarChar,
          status?.pricing?.category 
        )
        .input(
          'CountryCode',
          sql.VarChar,
          'IN'
        )
        .query(`
          SELECT TOP 1
            MetaCostPrice,
            ClientSellPrice,
            CurrencyCode
          FROM WhatsAppPricingMaster
          WHERE PartnerId = @PartnerId
            AND ConversationCategory = @ConversationCategory
            AND CountryCode = @CountryCode
            AND IsActive = 1
          ORDER BY EffectiveFrom DESC
        `);
    if (pricingResult.recordset.length > 0) {
      const pricing =
        pricingResult.recordset[0];
      const margin =
        Number(pricing.ClientSellPrice) -
        Number(pricing.MetaCostPrice);
        const existingBillingCheck =
  await new sql.Request(transaction)
    .input(
      'MetaMessageId',
      sql.VarChar,
      status.id
    )
    .query(`
      SELECT TOP 1 BillingId
      FROM BillingLedger
      WHERE MetaMessageId = @MetaMessageId
    `);
if (
  existingBillingCheck.recordset.length > 0
) {
  console.log(
    'Billing already exists, skipping duplicate billing for:',
    status.id
  );
  await transaction.commit();
  return {
    success: true,
    message:
      'Duplicate webhook ignored safely'
  };
}
      // STEP: Insert Billing Ledger
      await new sql.Request(transaction)
        .input(
          'QueueId',
          sql.BigInt,
          messageData.QueueId
        )
        .input(
          'SendId',
          sql.BigInt,
          messageData.SendId
        )
        .input(
          'PartnerId',
          sql.BigInt,
          messageData.PartnerId
        )
        .input(
          'TemplateId',
          sql.BigInt,
          messageData.TemplateId
        )
        .input(
          'MetaMessageId',
          sql.VarChar,
          status.id
        )
        .input(
          'ExternalReferenceId',
          sql.VarChar,
          messageData.ExternalReferenceId
        )
        .input(
          'BillingMonth',
          sql.VarChar,
          new Date()
            .toISOString()
            .slice(0, 7)
        )
        .input(
          'MessageCategory',
          sql.VarChar,
          status?.pricing?.category 
        )
        .input(
          'DeliveryStatus',
          sql.VarChar,
          status.status
        )
        .input(
          'IsBillable',
          sql.Bit,
          true
        )
        .input(
          'MessageCost',
          sql.Decimal(18, 4),
          pricing.MetaCostPrice
        )
        .input(
          'SellPrice',
          sql.Decimal(18, 4),
          pricing.ClientSellPrice
        )
        .input(
          'MarginAmount',
          sql.Decimal(18, 4),
          margin
        )
        .input(
          'CurrencyCode',
          sql.VarChar,
          pricing.CurrencyCode
        )
        .input(
          'BillingStatus',
          sql.VarChar,
          'PENDING'
        )
        .query(`
          INSERT INTO BillingLedger
          (
            QueueId,
            SendId,
            PartnerId,
            TemplateId,
            MetaMessageId,
            ExternalReferenceId,
            BillingMonth,
            MessageCategory,
            DeliveryStatus,
            IsBillable,
            MessageCost,
            SellPrice,
            MarginAmount,
            CurrencyCode,
            BillingStatus,
            CreatedAt
          )
          VALUES
          (
            @QueueId,
            @SendId,
            @PartnerId,
            @TemplateId,
            @MetaMessageId,
            @ExternalReferenceId,
            @BillingMonth,
            @MessageCategory,
            @DeliveryStatus,
            @IsBillable,
            @MessageCost,
            @SellPrice,
            @MarginAmount,
            @CurrencyCode,
            @BillingStatus,
            GETDATE()
          )
        `);
        await new sql.Request(transaction)
  .input(
    'PartnerId',
    sql.BigInt,
    messageData.PartnerId
  )
  .input(
    'DeductAmount',
    sql.Decimal(18, 4),
    pricing.ClientSellPrice
  )
  .query(`
    UPDATE PartnerWallet
    SET
      AvailableBalance =
        AvailableBalance - @DeductAmount,
      ConsumedBalance =
        ConsumedBalance + @DeductAmount,
      UpdatedAt = GETDATE()
    WHERE PartnerId = @PartnerId
      AND IsActive = 1
  `);
  await new sql.Request(transaction)
  .input(
    'MetaMessageId',
    sql.VarChar,
    status.id
  )
  .query(`
    UPDATE BillingLedger
    SET
      DeductedFromWallet = 1,
      DeductedAt = GETDATE()
    WHERE MetaMessageId = @MetaMessageId
  `);
    }
  }
}
      if (status.status === 'read') {
  await new sql.Request(transaction)
    .input(
      'MetaMessageId',
      sql.VarChar,
      status.id,
    )
    .input(
      'ReadTimestamp',
      sql.DateTime,
      status.timestamp
        ? new Date(
            Number(status.timestamp) * 1000,
          )
        : null,
    )
    .query(`
      UPDATE MessageSendLog
      SET
        ReadTimestamp = @ReadTimestamp,
        UpdatedAt = GETDATE()
      WHERE MetaMessageId = @MetaMessageId
    `);
}
  }
}
      // STEP 3: Mark Webhook as Processed
      const processedRequest =
        new sql.Request(transaction);

      await processedRequest
        .input(
          'MetaMessageId',
          sql.VarChar,
          metaMessageId ? String(metaMessageId) : null,
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