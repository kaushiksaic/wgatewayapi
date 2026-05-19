import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreatePartnerDto {
  @IsString()
  @IsNotEmpty()
  partnerCode!: string;

  @IsString()
  @IsNotEmpty()
  partnerName!: string;

  @IsString()
  @IsOptional()
  contactPerson?: string;

  @IsString()
  @IsOptional()
  mobile?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  billingType?: string;

  @IsNumber()
  @IsOptional()
  defaultPerMessageRate?: number;

  @IsString()
  @IsOptional()
  currencyCode?: string;

  @IsNumber()
  @IsOptional()
  creditLimit?: number;

  @IsString()
  @IsOptional()
  metaBusinessAccountId?: string;

  @IsString()
  @IsOptional()
  metaPhoneNumberId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}
