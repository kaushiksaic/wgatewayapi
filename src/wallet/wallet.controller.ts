import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { WalletService } from './wallet.service';
import { RechargeWalletDto } from './dto/recharge-wallet.dto';

import { JwtOrErpApiKeyGuard } from '../auth/guards/jwt-or-erp-api-key.guard';

@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('balances')
  @UseGuards(JwtOrErpApiKeyGuard)
  async getBalances(@Query('gatewayPartnerId') gatewayPartnerId?: string) {
    const partnerId =
      gatewayPartnerId && gatewayPartnerId !== 'all'
        ? Number(gatewayPartnerId)
        : undefined;
    return this.walletService.getWalletBalances(partnerId);
  }

  @Get('recharges')
  @UseGuards(JwtAuthGuard)
  async getRecharges(
    @Query('gatewayPartnerId') gatewayPartnerId?: string,
    @Query('walletId') walletId?: string,
  ) {
    const partnerId =
      gatewayPartnerId && gatewayPartnerId !== 'all'
        ? Number(gatewayPartnerId)
        : undefined;
    const wId =
      walletId && walletId !== 'all' ? Number(walletId) : undefined;
    return this.walletService.getRechargeHistory(partnerId, wId);
  }

  @Get('billing-summary')
  @UseGuards(JwtAuthGuard)
  async getBillingSummary(
    @Query('gatewayPartnerId') gatewayPartnerId?: string,
    @Query('billingMonth') billingMonth?: string,
  ) {
    const partnerId =
      gatewayPartnerId && gatewayPartnerId !== 'all'
        ? Number(gatewayPartnerId)
        : undefined;
    return this.walletService.getBillingSummary(partnerId, billingMonth);
  }

  @Get('pricing')
  @UseGuards(JwtAuthGuard)
  async getPricing(@Query('activeOnly') activeOnly?: string) {
    return this.walletService.getPricing(activeOnly !== 'false');
  }

  @Post('create')
  @UseGuards(JwtAuthGuard)
  async createWallet(@Body() createWalletDto: CreateWalletDto) {
    return this.walletService.createWallet(createWalletDto);
  }

  @Post('recharge')
  @UseGuards(JwtAuthGuard)
  async rechargeWallet(@Body() rechargeWalletDto: RechargeWalletDto) {
    return this.walletService.rechargeWallet(rechargeWalletDto);
  }
}


