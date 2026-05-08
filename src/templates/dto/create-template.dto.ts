import { IsString,IsNotEmpty,IsOptional,IsArray,ValidateNested,IsNumber } from "class-validator";
import { Type } from "class-transformer";

class TemplateVariableDto {
    @IsString()
    @IsNotEmpty()
    variableName!: string;

    @IsNumber()
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

  @IsNumber()
  createdBy!: number;


  @IsArray()
  @ValidateNested({each: true})
  @Type(() => TemplateVariableDto)
  variables!: TemplateVariableDto[];
}