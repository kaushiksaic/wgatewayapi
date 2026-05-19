import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString
} from 'class-validator';

export class CreateWalletDto {

  @IsNumber()
  @IsNotEmpty()
  partnerId!: number;

  @IsOptional()
  @IsString()
  currencyCode?: string;
}