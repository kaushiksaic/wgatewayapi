import { IsString,IsNotEmpty,IsOptional,IsNumber,IsArray,ValidateNested } from "class-validator";
import { Type } from "class-transformer";


class UpdateTemplateVariableDto {
    @IsString()
    variableName!: string;

    @IsNumber()
    variableOrder!: number;

    @IsOptional()
    @IsString()
    variableType?: string;
    
}


export class UpdateTemplateDto {
     @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  languageCode?: string;

  @IsOptional()
  @IsString()
  headerType?: string;

  @IsOptional()
  @IsString()
  headerText?: string;

  @IsOptional()
  @IsString()
  bodyText?: string;

  @IsOptional()
  @IsString()
  footerText?: string;

  @IsOptional()
  buttonJson?: any;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateTemplateVariableDto)
  variables?: UpdateTemplateVariableDto[];
}