import { IsString,IsNumber } from "class-validator";

export class MapTemplateDto {
    @IsNumber()
    partnerId!: number;

    @IsNumber()
    templateId!: number;

    @IsNumber()
    mappedBy!: number;

}