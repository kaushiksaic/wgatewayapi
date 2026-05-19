import { Injectable } from '@nestjs/common';
import { CreateWalletDto } from './dto/create-wallet.dto';
import * as sql from 'mssql';
import { RechargeWalletDto } from './dto/recharge-wallet.dto';

@Injectable()
export class WalletService {

    async createWallet(createWalletDto:CreateWalletDto){
        const pool = await sql.connect();

        try{

            const existingWallet = await pool.request()
            .input('PartnerId',sql.BigInt,createWalletDto.partnerId)
            .query(`
                SELECT WalletId
                FROM PartnerWallet
                WHERE PartnerId = @PartnerId
                `);

                if(existingWallet.recordset.length > 0){
                    return{
                        success:false,
                        message: 'Wallet already exists for this partner',
                    }
                }

                const result = await pool.request()
                .input('PartnerId',sql.BigInt,createWalletDto.partnerId)
                .input('CurrencyCode',sql.VarChar,createWalletDto.currencyCode || 'INR')
                .query(`
        INSERT INTO PartnerWallet
        (
          PartnerId,
          AvailableBalance,
          ConsumedBalance,
          CurrencyCode,
          IsActive,
          CreatedAt
        )
        OUTPUT INSERTED.WalletId
        VALUES
        (
          @PartnerId,
          0,
          0,
          @CurrencyCode,
          1,
          GETDATE()
        )
                    `)

        const walletId = result.recordset[0].WalletId;

        return {
            success: true,
            message: 'Wallet created successfully',
            walletId,
            data: {
                walletId,
                partnerId: createWalletDto.partnerId,
                currencyCode: createWalletDto.currencyCode || 'INR'
            }
        }

        } catch(error){
          console.error('Create Wallet error:',error)
          return {
            success: false,
            message:'Failed to create wallet',
            error:  error instanceof Error ? error.message :  'Unknown-error',
          };
        }
    }


    async rechargeWallet(rechargeWalletDto:RechargeWalletDto){
        const pool = await sql.connect();

        const transaction = new sql.Transaction(pool);

        try{

            await transaction.begin();

            const request = new sql.Request(transaction);

            const walletResult = await request
      .input(
        'WalletId',
        sql.BigInt,
        rechargeWalletDto.walletId
      )
      .input(
        'PartnerId',
        sql.BigInt,
        rechargeWalletDto.partnerId
      )
      .query(`
        SELECT
          WalletId,
          PartnerId,
          AvailableBalance
        FROM PartnerWallet
        WHERE WalletId = @WalletId
          AND PartnerId = @PartnerId
          AND IsActive = 1
      `);

      if(walletResult.recordset.length === 0){
        await transaction.rollback();

        return {
            success: false,
            message: 'Wallet not found',
        };
      }

      const wallet = walletResult.recordset[0];

      const balanceBefore = Number(wallet.AvailableBalance);

      const rechargeAmount = Number(rechargeWalletDto.rechargeAmount);

      if (rechargeAmount <= 0) {
        await transaction.rollback();

        return {
            success: false,
            message: 'Recharge amount must be greater than zero',
        };
      }

      const balanceAfter = balanceBefore + rechargeAmount;

      await request
      .input('WalletId', sql.BigInt, rechargeWalletDto.walletId)
      .input('PartnerId', sql.BigInt, rechargeWalletDto.partnerId)
      .input('RechargeAmount',sql.Decimal(18,4),rechargeAmount)
      .input('BalanceBefore',sql.Decimal(18,4),balanceBefore)
      .input('BalanceAfter',sql.Decimal(18,4),balanceAfter)
      .input('RechargeType',sql.VarChar,rechargeWalletDto.rechargeType || 'MANUAL')
      .input(
        'ReferenceNumber',
        sql.VarChar,
        rechargeWalletDto.referenceNumber || null
      )
      .input(
        'Notes',
        sql.NVarChar(sql.MAX),
        rechargeWalletDto.notes || null
      )
      .input(
        'RechargedBy',
        sql.VarChar,
        rechargeWalletDto.rechargedBy || null
      )
      .query(`
        INSERT INTO WalletRechargeTransactions
        (
          WalletId,
          PartnerId,
          RechargeAmount,
          BalanceBefore,
          BalanceAfter,
          RechargeType,
          ReferenceNumber,
          Notes,
          RechargedBy,
          RechargeDate,
          CreatedAt
        )
        VALUES
        (
          @WalletId,
          @PartnerId,
          @RechargeAmount,
          @BalanceBefore,
          @BalanceAfter,
          @RechargeType,
          @ReferenceNumber,
          @Notes,
          @RechargedBy,
          GETDATE(),
          GETDATE()
        )
      `);

      await request.input('UpdatedBalance',sql.Decimal(18,4),balanceAfter)
      .query(`
        UPDATE PartnerWallet
        SET AvailableBalance = @UpdatedBalance,
        LastRechargeAmount = @RechargeAmount,
        LastRechargeDate = GETDATE(),
        UpdatedAt = GETDATE()
        WHERE WalletId = @WalletId
        `)

        await transaction.commit();

        return {
            success: true,
            message: 'Wallet Recharged Successfully',
            data: {
                walletId: rechargeWalletDto.walletId,
                partnerId: rechargeWalletDto.partnerId,
                balanceBefore,
                rechargeAmount,
                balanceAfter
            }
        }

        } catch(error){
         await transaction.rollback();

    console.error('rechargeWallet error:', error);

    return {
      success: false,
      message: 'Failed to recharge wallet',
      error:
        error instanceof Error
          ? error.message
          : 'Unknown error',
    };
        }
    }

  async getWalletBalances(gatewayPartnerId?: number) {
    const pool = await sql.connect();
    try {
      const request = pool.request();
      let partnerFilter = '';

      if (gatewayPartnerId !== undefined && !Number.isNaN(gatewayPartnerId)) {
        request.input('PartnerId', sql.BigInt, gatewayPartnerId);
        partnerFilter = 'AND pw.PartnerId = @PartnerId';
      }

      const result = await request.query(`
        SELECT
          pw.WalletId,
          pw.PartnerId,
          p.PartnerName,
          p.PartnerCode,
          pw.AvailableBalance,
          pw.ConsumedBalance,
          pw.LastRechargeAmount,
          pw.LastRechargeDate,
          pw.CurrencyCode,
          pw.IsActive,
          pw.CreatedAt,
          pw.UpdatedAt
        FROM PartnerWallet pw
        INNER JOIN Partners p ON pw.PartnerId = p.PartnerId
        WHERE pw.IsActive = 1
        ${partnerFilter}
        ORDER BY p.PartnerName
      `);

      const rows = result.recordset.map((row) => ({
        walletId: row.WalletId,
        partnerId: row.PartnerId,
        partnerName: row.PartnerName,
        partnerCode: row.PartnerCode,
        availableBalance: Number(row.AvailableBalance),
        consumedBalance: Number(row.ConsumedBalance),
        lastRechargeAmount: row.LastRechargeAmount != null
          ? Number(row.LastRechargeAmount)
          : null,
        lastRechargeDate: row.LastRechargeDate,
        currencyCode: row.CurrencyCode,
        isActive: row.IsActive,
        createdAt: row.CreatedAt,
        updatedAt: row.UpdatedAt,
      }));

      const totals = rows.reduce(
        (acc, w) => ({
          availableBalance: acc.availableBalance + w.availableBalance,
          consumedBalance: acc.consumedBalance + w.consumedBalance,
        }),
        { availableBalance: 0, consumedBalance: 0 },
      );

      return {
        success: true,
        data: rows,
        totals: {
          ...totals,
          walletCount: rows.length,
          currencyCode: rows[0]?.currencyCode ?? 'INR',
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to fetch wallet balances',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getRechargeHistory(gatewayPartnerId?: number, walletId?: number) {
    const pool = await sql.connect();
    try {
      const request = pool.request();
      const filters: string[] = [];

      if (gatewayPartnerId !== undefined && !Number.isNaN(gatewayPartnerId)) {
        request.input('PartnerId', sql.BigInt, gatewayPartnerId);
        filters.push('wrt.PartnerId = @PartnerId');
      }
      if (walletId !== undefined && !Number.isNaN(walletId)) {
        request.input('WalletId', sql.BigInt, walletId);
        filters.push('wrt.WalletId = @WalletId');
      }

      const whereClause =
        filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

      const result = await request.query(`
        SELECT TOP 200
          wrt.RechargeTransactionId,
          wrt.WalletId,
          wrt.PartnerId,
          p.PartnerName,
          p.PartnerCode,
          wrt.RechargeAmount,
          wrt.BalanceBefore,
          wrt.BalanceAfter,
          wrt.RechargeType,
          wrt.ReferenceNumber,
          wrt.Notes,
          wrt.RechargedBy,
          wrt.RechargeDate,
          wrt.CreatedAt
        FROM WalletRechargeTransactions wrt
        INNER JOIN Partners p ON wrt.PartnerId = p.PartnerId
        ${whereClause}
        ORDER BY wrt.RechargeDate DESC
      `);

      return {
        success: true,
        data: result.recordset.map((row) => ({
          transactionId: row.RechargeTransactionId,
          walletId: row.WalletId,
          partnerId: row.PartnerId,
          partnerName: row.PartnerName,
          partnerCode: row.PartnerCode,
          rechargeAmount: Number(row.RechargeAmount),
          balanceBefore: Number(row.BalanceBefore),
          balanceAfter: Number(row.BalanceAfter),
          rechargeType: row.RechargeType,
          referenceNumber: row.ReferenceNumber,
          notes: row.Notes,
          rechargedBy: row.RechargedBy,
          rechargeDate: row.RechargeDate,
          createdAt: row.CreatedAt,
        })),
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to fetch recharge history',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getBillingSummary(gatewayPartnerId?: number, billingMonth?: string) {
    const pool = await sql.connect();
    try {
      const request = pool.request();
      const filters: string[] = [];

      if (gatewayPartnerId !== undefined && !Number.isNaN(gatewayPartnerId)) {
        request.input('PartnerId', sql.BigInt, gatewayPartnerId);
        filters.push('bl.PartnerId = @PartnerId');
      }
      if (billingMonth) {
        request.input('BillingMonth', sql.VarChar, billingMonth);
        filters.push('bl.BillingMonth = @BillingMonth');
      }

      const whereClause =
        filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

      const result = await request.query(`
        SELECT
          bl.PartnerId,
          p.PartnerName,
          p.PartnerCode,
          bl.BillingMonth,
          bl.CurrencyCode,
          COUNT(*) AS MessageCount,
          SUM(bl.MessageCost) AS TotalMessageCost,
          SUM(CASE WHEN bl.DeductedFromWallet = 1 THEN bl.MessageCost ELSE 0 END) AS WalletDeductedCost,
          SUM(CASE WHEN bl.IsBillable = 1 THEN 1 ELSE 0 END) AS BillableCount,
          SUM(ISNULL(bl.SellPrice, 0)) AS TotalSellPrice
        FROM BillingLedger bl
        INNER JOIN Partners p ON bl.PartnerId = p.PartnerId
        ${whereClause}
        GROUP BY
          bl.PartnerId,
          p.PartnerName,
          p.PartnerCode,
          bl.BillingMonth,
          bl.CurrencyCode
        ORDER BY bl.BillingMonth DESC, p.PartnerName
      `);

      const rows = result.recordset.map((row) => ({
        partnerId: row.PartnerId,
        partnerName: row.PartnerName,
        partnerCode: row.PartnerCode,
        billingMonth: row.BillingMonth,
        currencyCode: row.CurrencyCode,
        messageCount: row.MessageCount,
        totalMessageCost: Number(row.TotalMessageCost),
        walletDeductedCost: Number(row.WalletDeductedCost),
        billableCount: row.BillableCount,
        totalSellPrice: Number(row.TotalSellPrice),
      }));

      const totals = rows.reduce(
        (acc, r) => ({
          messageCount: acc.messageCount + r.messageCount,
          totalMessageCost: acc.totalMessageCost + r.totalMessageCost,
          walletDeductedCost: acc.walletDeductedCost + r.walletDeductedCost,
        }),
        { messageCount: 0, totalMessageCost: 0, walletDeductedCost: 0 },
      );

      return { success: true, data: rows, totals };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to fetch billing summary',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getPricing(activeOnly = true) {
    const pool = await sql.connect();
    try {
      const result = await pool.request().query(`
        SELECT
          PricingId,
          PartnerId,
          CountryCode,
          CountryName,
          ConversationCategory,
          MetaCostPrice,
          ClientSellPrice,
          CurrencyCode,
          EffectiveFrom,
          EffectiveTo,
          IsActive
        FROM WhatsAppPricingMaster
        ${activeOnly ? 'WHERE IsActive = 1' : ''}
        ORDER BY PartnerId, ConversationCategory, CountryCode
      `);

      return {
        success: true,
        data: result.recordset.map((row) => ({
          pricingId: row.PricingId,
          partnerId: row.PartnerId,
          countryCode: row.CountryCode,
          countryName: row.CountryName,
          conversationCategory: row.ConversationCategory,
          metaCostPrice: Number(row.MetaCostPrice),
          clientSellPrice: Number(row.ClientSellPrice),
          currencyCode: row.CurrencyCode,
          effectiveFrom: row.EffectiveFrom,
          effectiveTo: row.EffectiveTo,
          isActive: row.IsActive,
        })),
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to fetch pricing',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
