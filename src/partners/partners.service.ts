import { Injectable } from '@nestjs/common';
import * as sql from 'mssql';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { CreateExternalMappingDto } from './dto/create-external-mapping.dto';
import { WalletService } from '../wallet/wallet.service';

@Injectable()
export class PartnersService {
  constructor(private readonly walletService: WalletService) {}
  async listPartners(activeOnly = true) {
    const pool = await sql.connect();

    try {
      const result = await pool.request().query(`
        SELECT
          PartnerId,
          PartnerCode,
          PartnerName,
          ContactPerson,
          Mobile,
          Email,
          Address,
          BillingType,
          DefaultPerMessageRate,
          CurrencyCode,
          CreditLimit,
          MetaBusinessAccountId,
          MetaPhoneNumberId,
          IsActive,
          Notes,
          CreatedAt,
          UpdatedAt
        FROM Partners
        ${activeOnly ? 'WHERE IsActive = 1' : ''}
        ORDER BY PartnerName ASC
      `);

      return {
        success: true,
        data: result.recordset.map((row) => ({
          partnerId: row.PartnerId,
          partnerCode: row.PartnerCode,
          partnerName: row.PartnerName,
          contactPerson: row.ContactPerson,
          mobile: row.Mobile,
          email: row.Email,
          address: row.Address,
          billingType: row.BillingType,
          defaultPerMessageRate: row.DefaultPerMessageRate,
          currencyCode: row.CurrencyCode,
          creditLimit: row.CreditLimit,
          metaBusinessAccountId: row.MetaBusinessAccountId,
          metaPhoneNumberId: row.MetaPhoneNumberId,
          isActive: row.IsActive,
          notes: row.Notes,
          createdAt: row.CreatedAt,
          updatedAt: row.UpdatedAt,
        })),
      };
    } catch (error) {
      console.error('listPartners error:', error);
      return {
        success: false,
        message: 'Failed to fetch partners',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async createPartner(createPartnerDto: CreatePartnerDto) {
    const pool = await sql.connect();

    try {
      const duplicate = await pool
        .request()
        .input('PartnerCode', sql.VarChar, createPartnerDto.partnerCode)
        .query(`
          SELECT PartnerId
          FROM Partners
          WHERE PartnerCode = @PartnerCode
        `);

      if (duplicate.recordset.length > 0) {
        return {
          success: false,
          message: 'Partner code already exists',
        };
      }

      const result = await pool
        .request()
        .input('PartnerCode', sql.VarChar, createPartnerDto.partnerCode)
        .input('PartnerName', sql.VarChar, createPartnerDto.partnerName)
        .input('ContactPerson', sql.VarChar, createPartnerDto.contactPerson || null)
        .input('Mobile', sql.VarChar, createPartnerDto.mobile || null)
        .input('Email', sql.VarChar, createPartnerDto.email || null)
        .input('Address', sql.NVarChar(sql.MAX), createPartnerDto.address || null)
        .input(
          'BillingType',
          sql.VarChar,
          createPartnerDto.billingType || 'PER_MESSAGE',
        )
        .input(
          'DefaultPerMessageRate',
          sql.Decimal(18, 4),
          createPartnerDto.defaultPerMessageRate ?? null,
        )
        .input('CurrencyCode', sql.VarChar, createPartnerDto.currencyCode || 'INR')
        .input('CreditLimit', sql.Decimal(18, 2), createPartnerDto.creditLimit ?? null)
        .input(
          'MetaBusinessAccountId',
          sql.VarChar,
          createPartnerDto.metaBusinessAccountId || null,
        )
        .input(
          'MetaPhoneNumberId',
          sql.VarChar,
          createPartnerDto.metaPhoneNumberId || null,
        )
        .input('IsActive', sql.Bit, createPartnerDto.isActive ?? true)
        .input('Notes', sql.NVarChar(sql.MAX), createPartnerDto.notes || null)
        .query(`
          INSERT INTO Partners
          (
            PartnerCode,
            PartnerName,
            ContactPerson,
            Mobile,
            Email,
            Address,
            BillingType,
            DefaultPerMessageRate,
            CurrencyCode,
            CreditLimit,
            MetaBusinessAccountId,
            MetaPhoneNumberId,
            IsActive,
            Notes
          )
          OUTPUT INSERTED.PartnerId
          VALUES
          (
            @PartnerCode,
            @PartnerName,
            @ContactPerson,
            @Mobile,
            @Email,
            @Address,
            @BillingType,
            @DefaultPerMessageRate,
            @CurrencyCode,
            @CreditLimit,
            @MetaBusinessAccountId,
            @MetaPhoneNumberId,
            @IsActive,
            @Notes
          )
        `);

      const partnerId = result.recordset[0].PartnerId;

      const walletResult = await this.walletService.createWallet({
        partnerId,
        currencyCode: createPartnerDto.currencyCode || 'INR',
      });

      const walletCreated = walletResult.success;
      const walletId =
        walletResult.walletId ??
        (walletResult.data as { walletId?: number } | undefined)?.walletId;

      return {
        success: true,
        message: walletCreated
          ? 'Partner and wallet created successfully'
          : 'Partner created; wallet could not be created automatically',
        partnerId,
        walletId: walletId ?? undefined,
        walletWarning: walletCreated ? undefined : walletResult.message,
        data: {
          partnerId,
          partnerCode: createPartnerDto.partnerCode,
          partnerName: createPartnerDto.partnerName,
        },
      };
    } catch (error) {
      console.error('createPartner error:', error);
      return {
        success: false,
        message: 'Failed to create partner',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async listExternalMappings(activeOnly = true) {
    const pool = await sql.connect();

    try {
      const result = await pool.request().query(`
        SELECT
          pem.MappingId,
          pem.GatewayPartnerId,
          pem.ErpPartnerId,
          pem.SourceSystem,
          pem.IsActive,
          pem.CreatedAt,
          p.PartnerCode,
          p.PartnerName
        FROM PartnerExternalMapping pem
        INNER JOIN Partners p ON p.PartnerId = pem.GatewayPartnerId
        ${activeOnly ? 'WHERE pem.IsActive = 1' : ''}
        ORDER BY pem.CreatedAt DESC
      `);

      return {
        success: true,
        data: result.recordset.map((row) => ({
          mappingId: row.MappingId,
          gatewayPartnerId: row.GatewayPartnerId,
          erpPartnerId: row.ErpPartnerId,
          sourceSystem: row.SourceSystem,
          isActive: row.IsActive,
          createdAt: row.CreatedAt,
          partnerCode: row.PartnerCode,
          partnerName: row.PartnerName,
        })),
      };
    } catch (error) {
      console.error('listExternalMappings error:', error);
      return {
        success: false,
        message: 'Failed to fetch external mappings',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async createExternalMapping(dto: CreateExternalMappingDto) {
    const pool = await sql.connect();

    try {
      const partnerCheck = await pool
        .request()
        .input('GatewayPartnerId', sql.BigInt, dto.gatewayPartnerId)
        .query(`
          SELECT PartnerId, PartnerName
          FROM Partners
          WHERE PartnerId = @GatewayPartnerId AND IsActive = 1
        `);

      if (partnerCheck.recordset.length === 0) {
        return {
          success: false,
          message: 'Gateway partner not found or inactive',
        };
      }

      const erpDuplicate = await pool
        .request()
        .input('ErpPartnerId', sql.VarChar, dto.erpPartnerId.trim())
        .query(`
          SELECT MappingId
          FROM PartnerExternalMapping
          WHERE ErpPartnerId = @ErpPartnerId AND IsActive = 1
        `);

      if (erpDuplicate.recordset.length > 0) {
        return {
          success: false,
          message: 'ERP Partner ID is already mapped to a gateway partner',
        };
      }

      const pairDuplicate = await pool
        .request()
        .input('GatewayPartnerId', sql.BigInt, dto.gatewayPartnerId)
        .input('ErpPartnerId', sql.VarChar, dto.erpPartnerId.trim())
        .query(`
          SELECT MappingId
          FROM PartnerExternalMapping
          WHERE GatewayPartnerId = @GatewayPartnerId
            AND ErpPartnerId = @ErpPartnerId
            AND IsActive = 1
        `);

      if (pairDuplicate.recordset.length > 0) {
        return {
          success: false,
          message: 'This gateway and ERP partner mapping already exists',
        };
      }

      const result = await pool
        .request()
        .input('GatewayPartnerId', sql.BigInt, dto.gatewayPartnerId)
        .input('ErpPartnerId', sql.VarChar, dto.erpPartnerId.trim())
        .input('SourceSystem', sql.VarChar, dto.sourceSystem.trim())
        .input('IsActive', sql.Bit, dto.isActive ?? true)
        .query(`
          INSERT INTO PartnerExternalMapping
          (
            GatewayPartnerId,
            ErpPartnerId,
            SourceSystem,
            IsActive,
            CreatedAt
          )
          OUTPUT INSERTED.MappingId
          VALUES
          (
            @GatewayPartnerId,
            @ErpPartnerId,
            @SourceSystem,
            @IsActive,
            GETDATE()
          )
        `);

      const mappingId = result.recordset[0].MappingId;
      const partner = partnerCheck.recordset[0];

      return {
        success: true,
        message: 'ERP partner mapped successfully',
        mappingId,
        data: {
          mappingId,
          gatewayPartnerId: dto.gatewayPartnerId,
          erpPartnerId: dto.erpPartnerId.trim(),
          sourceSystem: dto.sourceSystem.trim(),
          partnerName: partner.PartnerName,
        },
      };
    } catch (error) {
      console.error('createExternalMapping error:', error);
      return {
        success: false,
        message: 'Failed to create external mapping',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async deactivateExternalMapping(mappingId: string) {
    const pool = await sql.connect();

    try {
      const result = await pool
        .request()
        .input('MappingId', sql.BigInt, mappingId)
        .query(`
          UPDATE PartnerExternalMapping
          SET IsActive = 0
          WHERE MappingId = @MappingId AND IsActive = 1
        `);

      if (result.rowsAffected[0] === 0) {
        return {
          success: false,
          message: 'Mapping not found or already inactive',
        };
      }

      return {
        success: true,
        message: 'Mapping deactivated successfully',
      };
    } catch (error) {
      console.error('deactivateExternalMapping error:', error);
      return {
        success: false,
        message: 'Failed to deactivate mapping',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
