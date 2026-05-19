import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateExternalMappingDto {
  @IsNumber()
  gatewayPartnerId!: number;

  @IsString()
  @IsNotEmpty()
  erpPartnerId!: string;

  @IsString()
  @IsNotEmpty()
  sourceSystem!: string;

  @IsOptional()
  isActive?: boolean;
}
