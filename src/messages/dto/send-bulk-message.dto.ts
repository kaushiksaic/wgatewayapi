import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsString,
  ValidateNested,
  IsObject
} from 'class-validator';
import { Type } from 'class-transformer';

class RecipientDto {
  @IsString()
  @IsNotEmpty()
  to!: string;

  @IsString()
  @IsNotEmpty()
  externalReferenceId!: string;

  @IsObject()
  @IsNotEmpty()
  parameters!: Record<string, any>;
}

export class SendBulkMessageDto {
//   @IsNumber()
//   partnerId!: number;

@IsNumber()
erpPartnerId!: number;

  @IsString()
  @IsNotEmpty()
  templateName!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipientDto)
  recipients!: RecipientDto[];
}