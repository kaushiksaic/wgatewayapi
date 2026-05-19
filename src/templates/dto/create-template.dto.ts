import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

class TemplateVariableDto {
    @IsString()
    @IsNotEmpty()
    variableName!: string;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    variableOrder!: number;

    @IsString()
    @IsOptional()
    variableType?: string;

    @IsString()
    @IsNotEmpty()
    sampleValue?: string
}


export class CreateTemplateDto {
    @IsString()
    @IsNotEmpty()
    templateCode!: string;

    @IsString()
    @IsNotEmpty()
    templateName!: string;

    @IsString()
    @IsNotEmpty()
    category!: string;

    @IsString()
    @IsNotEmpty()
    languageCode!: string;

    @IsString()
    @IsOptional()
    headerType?: string;

    @IsString()
    @IsOptional()
    headerText?: string;

    @IsString()
    @IsNotEmpty()
    bodyText!: string;

    @IsString()
  @IsOptional()
  footerText?: string;

  @IsOptional()
  buttonJson?: any;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  createdBy!: number;


  @IsArray()
  @ValidateNested({each: true})
  @Type(() => TemplateVariableDto)
  variables!: TemplateVariableDto[];
}