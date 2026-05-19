import { IsNumber,IsBoolean, IsNotEmpty, IsDecimal, IsString, IsOptional } from "class-validator";


export class RechargeWalletDto {
    @IsNumber()
    @IsNotEmpty()
    walletId!: number;

    @IsNumber()
    @IsNotEmpty()
    partnerId!: number;

    @IsNumber()
    @IsNotEmpty()
    rechargeAmount!: number;

    @IsOptional()
    @IsString()
    rechargeType?: string;

    @IsOptional()
    @IsString()
    referenceNumber?: string;

    @IsOptional()
    @IsString()
    notes?: string;

    @IsOptional()
    @IsString()
    rechargedBy?: string;
}