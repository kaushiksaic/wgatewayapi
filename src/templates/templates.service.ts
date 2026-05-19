import { Injectable } from '@nestjs/common';
import { CreateTemplateDto } from './dto/create-template.dto';
import * as sql from 'mssql'
import { UpdateTemplateDto } from './dto/update-template.dto';
import { MetaService } from './meta.service';
import { MapTemplateDto } from './dto/map-template.dto';

@Injectable()
export class TemplatesService {

  constructor(
    private readonly metaService:MetaService
  ) {}

    async createTemplate(createTemplateDto:CreateTemplateDto){
        const pool = await sql.connect();

        const transaction  = new sql.Transaction(pool);

        try{
            await transaction.begin();

            const templateRequest = new sql.Request(transaction);

            const templateResult = await templateRequest
            .input('TemplateCode',sql.VarChar,createTemplateDto.templateCode)
            .input('TemplateName',sql.VarChar,createTemplateDto.templateName)
            .input('Category', sql.VarChar, createTemplateDto.category)
        .input('LanguageCode', sql.VarChar, createTemplateDto.languageCode)
        .input('HeaderType', sql.VarChar, createTemplateDto.headerType || null)
        .input('HeaderText', sql.NVarChar(sql.MAX), createTemplateDto.headerText || null)
        .input('BodyText', sql.NVarChar(sql.MAX), createTemplateDto.bodyText)
        .input('FooterText', sql.NVarChar(sql.MAX), createTemplateDto.footerText || null)
        .input('ButtonJson', sql.NVarChar(sql.MAX), JSON.stringify(createTemplateDto.buttonJson || null))
        .input('CreatedBy', sql.BigInt, createTemplateDto.createdBy)
        .query(
            `INSERT INTO MessageTemplates
          (
            TemplateCode,
            TemplateName,
            Category,
            LanguageCode,
            HeaderType,
            HeaderText,
            BodyText,
            FooterText,
            ButtonJson,
            MetaStatus,
            CreatedBy
          )
          OUTPUT INSERTED.TemplateId
          VALUES
          (
            @TemplateCode,
            @TemplateName,
            @Category,
            @LanguageCode,
            @HeaderType,
            @HeaderText,
            @BodyText,
            @FooterText,
            @ButtonJson,
            'DRAFT',
            @CreatedBy
          )`
        )

        const templateId = templateResult.recordset[0].TemplateId;

        for(const variable of createTemplateDto.variables){
            const variableRequest = new sql.Request(transaction);

            await variableRequest
            .input('TemplateId', sql.BigInt, templateId)
          .input('VariableName', sql.VarChar, variable.variableName)
          .input('VariableOrder', sql.Int, variable.variableOrder)
          .input('VariableType', sql.VarChar, variable.variableType || 'TEXT')
          .input(
  'SampleValue',
  sql.VarChar,
  variable.sampleValue || null
)
          .query(`
            INSERT INTO TemplateVariables
            (
              TemplateId,
              VariableName,
              VariableOrder,
              VariableType,
              SampleValue
            )
            VALUES
            (
              @TemplateId,
              @VariableName,
              @VariableOrder,
              @VariableType,
              @SampleValue
            )
          `);
        }

        await transaction.commit();

        return {
            success: true,
            message: 'Template created successfully',
            templateId: templateId,
            status: 'DRAFT',
            data: createTemplateDto
        };
        } catch(error){
            await transaction.rollback();
            console.error('Error creating new template:',error);
            return {
                success: false,
                message: 'Failed to create a template',
                error: error instanceof Error ? error.message : 'Unknown error occured',
            }
        }

        
    }


    async updateTemplate(templateId:string,updateTemplateDto:UpdateTemplateDto){
        const pool = await sql.connect();
        const transaction = new sql.Transaction(pool);
        try{

        await transaction.begin();

        const checkRequest = new sql.Request(transaction);


            const checkResult = await 
            checkRequest
            .input('TemplateId',sql.BigInt,templateId)
            .query(`
                SELECT TemplateId, MetaStatus
                FROM MessageTemplates
                WHERE TemplateId = @TemplateId
                `);

                if(checkResult.recordset.length === 0){
                    await transaction.rollback();
                    return{
                        success: false,
                        message: 'Template Not Found'
                    };
                }

                const template = checkResult.recordset[0];

                if(template.MetaStatus !== 'DRAFT'){
                    await transaction.rollback();
                    return {
                        success: false,
                        message: 'Only DRAFT templates can be updated'
                    };
                }


                const updateRequest = new sql.Request(transaction);

                await updateRequest
       .input('TemplateId', sql.BigInt, templateId)
      .input('Category', sql.VarChar, updateTemplateDto.category || null)
      .input('LanguageCode', sql.VarChar, updateTemplateDto.languageCode || null)
      .input('HeaderType', sql.VarChar, updateTemplateDto.headerType || null)
      .input('HeaderText', sql.NVarChar(sql.MAX), updateTemplateDto.headerText || null)
      .input('BodyText', sql.NVarChar(sql.MAX), updateTemplateDto.bodyText || null)
      .input('FooterText', sql.NVarChar(sql.MAX), updateTemplateDto.footerText || null)
      .input(
        'ButtonJson',
        sql.NVarChar(sql.MAX),
        JSON.stringify(updateTemplateDto.buttonJson || null),
      )
      .query(`
        UPDATE MessageTemplates
        SET
          Category = @Category,
          LanguageCode = @LanguageCode,
          HeaderType = @HeaderType,
          HeaderText = @HeaderText,
          BodyText = @BodyText,
          FooterText = @FooterText,
          ButtonJson = @ButtonJson,
          UpdatedAt = GETDATE()
        WHERE TemplateId = @TemplateId
      `);

      if(updateTemplateDto.variables?.length){
        const deleteRequest = new sql.Request(transaction);

        await deleteRequest
        .input('TemplateId', sql.BigInt, templateId)
        .query(`
          DELETE FROM TemplateVariables
          WHERE TemplateId = @TemplateId
        `);

        for(const variable of updateTemplateDto.variables){
            const variableRequest = new sql.Request(transaction);

            await variableRequest
          .input('TemplateId', sql.BigInt, templateId)
          .input('VariableName', sql.VarChar, variable.variableName)
          .input('VariableOrder', sql.Int, variable.variableOrder)
          .input(
            'VariableType',
            sql.VarChar,
            variable.variableType || 'TEXT',
          )
          .query(`
            INSERT INTO TemplateVariables
            (
              TemplateId,
              VariableName,
              VariableOrder,
              VariableType
            )
            VALUES
            (
              @TemplateId,
              @VariableName,
              @VariableOrder,
              @VariableType
            )
          `);
        }
        
      }

      await transaction.commit();

                return {
                    success: true,
                    message: 'Template updated successfully',
                    templateId,
                }
        } catch(error){
            await transaction.rollback();
            return{
                success: false,
                message: 'Error updating template',
                error: error instanceof Error ? error.message : 'Unknown Error'
            }
        }
    }

    async submitTemplate(templateId:string){
        const pool = await sql.connect();
      
        try{
             const templateResult = await pool
      .request()
      .input('TemplateId', sql.BigInt, templateId)
      .query(`
        SELECT
          TemplateId,
          TemplateName,
          Category,
          LanguageCode,
          HeaderType,
          HeaderText,
          BodyText,
          FooterText,
          ButtonJson,
          MetaStatus
        FROM MessageTemplates
        WHERE TemplateId = @TemplateId
      `);

    if (templateResult.recordset.length === 0) {
      return {
        success: false,
        message: 'Template not found',
      };
    }

    const template = templateResult.recordset[0];

    // Step 2: Only DRAFT allowed
    if (template.MetaStatus !== 'DRAFT') {
      return {
        success: false,
        message: 'Only DRAFT templates can be submitted',
      };
    }

    const variableResult = await pool.request()
    .input('TemplateId',sql.BigInt,templateId)
    .query(`
         SELECT
          VariableName,
          VariableOrder,
          VariableType,
          SampleValue
        FROM TemplateVariables
        WHERE TemplateId = @TemplateId
        ORDER BY VariableOrder ASC
        `);


        const sampleValues = variableResult.recordset.map(
  (item) => item.SampleValue || 'Sample'
);


       const metaPayload:any = {
        name: template.TemplateName,
        category: template.Category,
        language: template.LanguageCode,
        parameter_format: 'POSITIONAL',
        components: [
            {
                type: 'BODY',
                text: template.BodyText,
                example: {
  body_text: [
    sampleValues
  ]
}
            }
        ],
       };

       if(template.HeaderType && template.HeaderText){
        metaPayload.components.unshift({
            type: 'HEADER',
            format: template.HeaderType,
            text: template.HeaderText
        });
       }

       if(template.FooterText){
        metaPayload.components.push({
            type: 'FOOTER',
            text: template.FooterText
        });
       }

       const metaResponse = await this.metaService.submitTemplate(metaPayload)

       if(!metaResponse.success){
        return {
            success: false,
            message: 'Meta template submission failed',
            error: metaResponse.error
        }
       }

       await pool
      .request()
      .input('TemplateId', sql.BigInt, templateId)
      .input(
        'MetaTemplateId',
        sql.VarChar,
        metaResponse.data.id || null,
      )
      .input(
        'MetaResponse',
        sql.NVarChar(sql.MAX),
        JSON.stringify(metaResponse.data),
      )
      .query(`
        UPDATE MessageTemplates
        SET
          MetaStatus = 'PENDING',
          MetaTemplateId = @MetaTemplateId,
          MetaResponse = @MetaResponse,
          UpdatedAt = GETDATE()
        WHERE TemplateId = @TemplateId
      `);

    return {
      success: true,
      message: 'Template submitted to Meta successfully',
      templateId,
      metaStatus: 'PENDING',
      metaResponse: metaResponse.data,
    };

        }catch (error) {
    console.error(error);

    return {
      success: false,
      message: 'Template submission failed',
      error:
        error instanceof Error
          ? error.message
          : 'Unknown error occurred',
    };
  }
    }

    async mapTemplateToPartner(mapTemplateDto: MapTemplateDto){
        const pool =  await sql.connect();

        try {
    // Step 1: Validate Template Exists
    const templateResult = await pool
      .request()
      .input(
        'TemplateId',
        sql.BigInt,
        mapTemplateDto.templateId,
      )
      .query(`
        SELECT
          TemplateId,
          MetaStatus
        FROM MessageTemplates
        WHERE TemplateId = @TemplateId
      `);

    if (templateResult.recordset.length === 0) {
      return {
        success: false,
        message: 'Template not found',
      };
    }

    const template =
      templateResult.recordset[0];

    // Step 2: Only APPROVED templates allowed
    if (template.MetaStatus !== 'APPROVED') {
      return {
        success: false,
        message:
          'Only APPROVED templates can be mapped',
      };
    }

    // Step 3: Prevent Duplicate Mapping
    const mappingCheck = await pool
      .request()
      .input(
        'PartnerId',
        sql.BigInt,
        mapTemplateDto.partnerId,
      )
      .input(
        'TemplateId',
        sql.BigInt,
        mapTemplateDto.templateId,
      )
      .query(`
        SELECT MappingId
        FROM PartnerTemplateMapping
        WHERE PartnerId = @PartnerId
          AND TemplateId = @TemplateId
          AND IsEnabled = 1
      `);

    if (mappingCheck.recordset.length > 0) {
      return {
        success: false,
        message:
          'Template already mapped to this partner',
      };
    }

    // Step 4: Insert Mapping
    await pool
      .request()
      .input(
        'PartnerId',
        sql.BigInt,
        mapTemplateDto.partnerId,
      )
      .input(
        'TemplateId',
        sql.BigInt,
        mapTemplateDto.templateId,
      )
      .input(
        'MappedBy',
        sql.BigInt,
        mapTemplateDto.mappedBy,
      )
      .query(`
        INSERT INTO PartnerTemplateMapping
        (
          PartnerId,
          TemplateId,
          IsEnabled,
          CreatedBy,
          CreatedAt
        )
        VALUES
        (
          @PartnerId,
          @TemplateId,
          1,
          @MappedBy,
          GETDATE()
        )
      `);

    return {
      success: true,
      message:
        'Template mapped to partner successfully',
    };
  } catch (error) {
    console.error(error);

    return {
      success: false,
      message: 'Mapping failed',
      error:
        error instanceof Error
          ? error.message
          : 'Unknown error occurred',
    };
  }
    }
  async listTemplates(gatewayPartnerId?: number) {
    if (gatewayPartnerId !== undefined && !Number.isNaN(gatewayPartnerId)) {
      return this.getTemplatesByGatewayPartner(gatewayPartnerId);
    }
    return this.getAllTemplates();
  }

  async getAllTemplates() {
    const pool = await sql.connect();
    try {
      const templateResult = await pool.request().query(`
        SELECT
          TemplateId,
          TemplateCode,
          TemplateName,
          Category,
          LanguageCode,
          HeaderText,
          BodyText,
          FooterText,
          MetaStatus
        FROM MessageTemplates
        WHERE IsActive = 1
        ORDER BY TemplateName
      `);

      const templates = templateResult.recordset.map((row) => ({
        templateId: row.TemplateId,
        templateCode: row.TemplateCode,
        templateName: row.TemplateName,
        category: row.Category,
        languageCode: row.LanguageCode,
        headerText: row.HeaderText,
        bodyText: row.BodyText,
        footerText: row.FooterText,
        metaStatus: row.MetaStatus,
        variables: [] as unknown[],
      }));

      return { success: true, data: templates };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to fetch templates',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getTemplatesByGatewayPartner(gatewayPartnerId: number) {
    const pool = await sql.connect();
    try {
      const templateResult = await pool
        .request()
        .input('PartnerId', sql.BigInt, gatewayPartnerId)
        .query(`
          SELECT
            mt.TemplateId,
            mt.TemplateCode,
            mt.TemplateName,
            mt.Category,
            mt.LanguageCode,
            mt.HeaderText,
            mt.BodyText,
            mt.FooterText,
            mt.MetaStatus
          FROM PartnerTemplateMapping ptm
          INNER JOIN MessageTemplates mt ON ptm.TemplateId = mt.TemplateId
          WHERE ptm.PartnerId = @PartnerId
            AND ptm.IsEnabled = 1
            AND mt.IsActive = 1
          ORDER BY mt.TemplateName
        `);

      const templates: unknown[] = [];
      for (const template of templateResult.recordset) {
        const variableResult = await pool
          .request()
          .input('TemplateId', sql.BigInt, template.TemplateId)
          .query(`
            SELECT VariableName, VariableOrder, SampleValue
            FROM TemplateVariables
            WHERE TemplateId = @TemplateId
            ORDER BY VariableOrder
          `);

        templates.push({
          templateId: template.TemplateId,
          templateCode: template.TemplateCode,
          templateName: template.TemplateName,
          category: template.Category,
          languageCode: template.LanguageCode,
          headerText: template.HeaderText,
          bodyText: template.BodyText,
          footerText: template.FooterText,
          metaStatus: template.MetaStatus,
          variables: variableResult.recordset,
        });
      }

      return { success: true, data: templates };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to fetch templates',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /** Legacy: resolve ERP id via PartnerExternalMapping */
  async getTemplatesByPartner(erpPartnerId: string) {
    const pool = await sql.connect();
    try {
      const partnerResult = await pool
        .request()
        .input('ErpPartnerId', sql.VarChar, erpPartnerId)
        .query(`
          SELECT GatewayPartnerId
          FROM PartnerExternalMapping
          WHERE ErpPartnerId = @ErpPartnerId AND IsActive = 1
        `);

      if (partnerResult.recordset.length === 0) {
        return { success: false, message: 'Partner mapping not found' };
      }

      return this.getTemplatesByGatewayPartner(
        partnerResult.recordset[0].GatewayPartnerId,
      );
    } catch (error) {
      return {
        success: false,
        message: 'Failed to fetch templates',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
